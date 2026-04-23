import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../auth/middleware.js";
import { notifyAdmins } from "../bot.js";

// Очень терпимая схема: фронт может слать строку либо как { productId } либо как { product: {...} }.
// Подарки могут не иметь priceUSD/variantId. Главное — валидное qty и хотя бы какой-то идентификатор товара.
const CartLineSchema = z
  .object({
    productId: z.string().optional(),
    product: z.any().optional(),
    productName: z.any().optional(),
    qty: z.number().int().positive().max(99),
    variantId: z.string().optional(),
    districtSlug: z.string().nullish(),
    stashType: z.string().nullish(),
    priceUSD: z.number().nonnegative().nullish(),
    isGift: z.boolean().optional(),
  })
  .passthrough()
  .superRefine((item, ctx) => {
    const productId = item.productId ?? item.product?.id;
    if (!productId || typeof productId !== "string") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "product_id_required", path: ["productId"] });
    }
  });

const CreateOrderSchema = z.object({
  totalUSD: z.number().nonnegative().max(1000000),
  items: z.array(CartLineSchema).min(1).max(50),
  delivery: z.boolean(),
  deliveryAddress: z.string().max(500).nullish(),
  crypto: z.string().nullish(),
  payAddress: z.string().nullish(),
});

export async function orderRoutes(app: FastifyInstance) {
  /**
   * POST /api/orders — оформить заказ.
   * Атомарно: списываем баланс юзера и создаём заказ в статусе "awaiting".
   * Защита от дублей: если последний заказ юзера создан < 5 сек назад с тем же total — возвращаем его.
   */
  app.post("/orders", { preHandler: requireAuth }, async (req, reply) => {
    const parsed = CreateOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      req.log.warn({ issues: parsed.error.flatten(), body: req.body }, "order validation failed");
      return reply.code(400).send({ error: "validation_failed", details: parsed.error.flatten() });
    }

    const data = parsed.data;
    if (data.delivery && !data.deliveryAddress?.toString().trim()) {
      return reply.code(400).send({ error: "delivery_address_required" });
    }

    const snapshotItems = data.items.map((item: any) => ({
      ...item,
      productId: item.productId ?? item.product?.id,
      productName: item.productName ?? item.product?.name,
      priceUSD: item.priceUSD ?? 0,
    }));

    // Защита от двойного клика: ищем недавний awaiting-заказ по userTgId+totalUSD за последние 5 сек.
    // НЕ используем JSON-equality по items — оно может выкидывать ошибки и тормозить.
    const recentSame = await prisma.order.findFirst({
      where: {
        userTgId: req.user!.tgId,
        status: "awaiting",
        totalUSD: data.totalUSD,
        delivery: data.delivery,
        createdAt: { gte: new Date(Date.now() - 5_000) },
      },
      orderBy: { createdAt: "desc" },
    });
    if (recentSame) {
      return reply.code(200).send(serialize(recentSame));
    }

    try {
      // Атомарно: проверяем баланс, списываем, создаём заказ.
      const order = await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({ where: { tgId: req.user!.tgId } });
        if (!user) throw new Error("user_not_found");
        if (user.balanceUSD + 1e-6 < data.totalUSD) {
          const err: any = new Error("insufficient_balance");
          err.code = "insufficient_balance";
          err.balanceUSD = user.balanceUSD;
          throw err;
        }
        await tx.user.update({
          where: { tgId: user.tgId },
          data: { balanceUSD: { decrement: data.totalUSD } },
        });
        return tx.order.create({
          data: {
            userTgId: user.tgId,
            totalUSD: data.totalUSD,
            items: snapshotItems as any,
            delivery: data.delivery,
            deliveryAddress: data.deliveryAddress ?? undefined,
            crypto: data.crypto ?? undefined,
            payAddress: data.payAddress ?? undefined,
            status: "awaiting",
          },
        });
      });

      // Уведомление админам — не блокирует ответ.
      try {
        const user = await prisma.user.findUnique({ where: { tgId: order.userTgId } });
        const who = user?.username ? `@${user.username}` : user?.firstName ?? `tg:${order.userTgId}`;
        const itemsCount = Array.isArray(order.items) ? (order.items as any[]).length : 0;
        const text =
          `🛒 <b>Новая заявка на заказ</b> #${order.id}\n` +
          `👤 ${who}\n` +
          `💰 $${order.totalUSD.toFixed(2)}\n` +
          `📦 позиций: ${itemsCount}` +
          (order.delivery ? `\n🚚 доставка: ${order.deliveryAddress ?? "—"}` : "");
        notifyAdmins(text).catch((err) =>
          req.log.error({ err }, "notifyAdmins failed for new order")
        );
      } catch (err) {
        req.log.error({ err }, "failed to build admin notification");
      }

      return serialize(order);
    } catch (e: any) {
      if (e?.code === "insufficient_balance") {
        return reply.code(402).send({ error: "insufficient_balance", balanceUSD: e.balanceUSD });
      }
      if (e?.message === "user_not_found") {
        return reply.code(401).send({ error: "unauthorized" });
      }
      req.log.error({ err: e, body: req.body }, "failed to create order");
      return reply.code(500).send({ error: "internal", message: String(e?.message ?? e) });
    }
  });

  /** GET /api/orders/me — мои заказы */
  app.get("/orders/me", { preHandler: requireAuth }, async (req) => {
    const list = await prisma.order.findMany({
      where: { userTgId: req.user!.tgId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return list.map(serialize);
  });
}

export function serialize(o: any) {
  return {
    id: o.id,
    createdAt: o.createdAt.toISOString(),
    totalUSD: o.totalUSD,
    items: o.items,
    delivery: o.delivery,
    deliveryAddress: o.deliveryAddress ?? undefined,
    status: o.status,
    crypto: o.crypto ?? undefined,
    payAddress: o.payAddress ?? undefined,
    confirmPhoto: o.confirmPhotoUrl ?? undefined,
    confirmText: o.confirmText ?? undefined,
    confirmedAt: o.confirmedAt?.toISOString(),
  };
}
