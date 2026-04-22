import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../auth/middleware.js";
import { notifyAdmins } from "../bot.js";

const CartLineSchema = z.object({
  productId: z.string(),
  productName: z.any().optional(),
  qty: z.number().int().positive().max(99),
  variantId: z.string().optional(),
  districtSlug: z.string().optional(),
  stashType: z.enum(["prikop", "klad", "magnit"]).optional(),
  priceUSD: z.number().nonnegative().optional(),
});

const CreateOrderSchema = z.object({
  totalUSD: z.number().nonnegative().max(1000000),
  items: z.array(CartLineSchema).min(1).max(50),
  delivery: z.boolean(),
  deliveryAddress: z.string().max(500).optional(),
  crypto: z.string().optional(),
  payAddress: z.string().optional(),
});

export async function orderRoutes(app: FastifyInstance) {
  /** POST /api/orders — оформить заказ. Списывает с баланса в одной транзакции. */
  app.post("/orders", { preHandler: requireAuth }, async (req, reply) => {
    const parsed = CreateOrderSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const data = parsed.data;
    if (data.delivery && !data.deliveryAddress?.trim()) {
      return reply.code(400).send({ error: "delivery_address_required" });
    }

    const order = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { tgId: req.user!.tgId } });
      if (!user) throw new Error("user_not_found");
      if (user.balanceUSD < data.totalUSD) throw new Error("insufficient_balance");

      await tx.user.update({
        where: { tgId: user.tgId },
        data: { balanceUSD: { decrement: data.totalUSD } },
      });

      return tx.order.create({
        data: {
          userTgId: user.tgId,
          totalUSD: data.totalUSD,
          items: data.items as any,
          delivery: data.delivery,
          deliveryAddress: data.deliveryAddress,
          crypto: data.crypto,
          payAddress: data.payAddress,
          status: "awaiting",
        },
      });
    }).catch((e: Error) => {
      if (e.message === "insufficient_balance") {
        reply.code(402).send({ error: "insufficient_balance" });
        return null;
      }
      reply.code(500).send({ error: "internal" });
      return null;
    });

    if (!order) return;

    const user = await prisma.user.findUnique({ where: { tgId: req.user!.tgId } });
    const who = user?.username ? `@${user.username}` : user?.firstName ?? `tg:${order.userTgId}`;
    notifyAdmins(`🛒 <b>Новый заказ</b>\n${who}\n$${order.totalUSD}${order.delivery ? " · доставка" : ""}`);

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
