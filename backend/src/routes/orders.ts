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
  /** POST /api/orders — оформить заказ и отправить его в админку на подтверждение. */
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

    const user = await prisma.user.findUnique({ where: { tgId: req.user!.tgId } });
    if (!user) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const order = await prisma.order.create({
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
    }).catch((e: Error) => {
      req.log.error({ err: e }, "failed to create order");
      reply.code(500).send({ error: "internal" });
      return null;
    });

    if (!order) return;

    try {
      const who = user?.username ? `@${user.username}` : user?.firstName ?? `tg:${order.userTgId}`;
      const itemsCount = Array.isArray(order.items) ? (order.items as any[]).length : 0;
      const text =
        `🛒 <b>Новый заказ</b> #${order.id}\n` +
        `👤 ${who}\n` +
        `💰 $${order.totalUSD.toFixed(2)}\n` +
        `📦 позиций: ${itemsCount}` +
        (order.delivery ? `\n🚚 доставка: ${order.deliveryAddress ?? "—"}` : "");
      // не блокируем ответ пользователю
      notifyAdmins(text).catch((err) =>
        req.log.error({ err }, "notifyAdmins failed for new order")
      );
    } catch (err) {
      req.log.error({ err }, "failed to build admin notification");
    }

    return serialize(order);
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
