import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../auth/middleware.js";
import { notifyAdmins } from "../bot.js";

// Эти адреса должны совпадать с фронтом (CRYPTO_LIST в src/store/account.ts).
// Дублируем здесь, чтобы клиент не мог подделать адрес.
const CRYPTO_ADDRESSES: Record<string, string> = {
  USDT: "TRGD4qP5SThQ2kt11jaKfUW6pZf2TpaDHt",
  TRX: "TRGD4qP5SThQ2kt11jaKfUW6pZf2TpaDHt",
  BTC: "18JxaejFvEvSTxmPsJvmpYVxudHrVbofdu",
  SOL: "FDpmT2bW8Y685CtFcMWSBuJi7D6xtr2JrNiMFDQCpJVe",
  TON: "EQAaPP8_JvEXQAxXE2K1F8LoIuRYbDNYzWmvpgw0XRarsVvQ",
};

const CreateSchema = z.object({
  amountUSD: z.number().positive().max(100000),
  crypto: z.enum(["USDT", "TRX", "BTC", "SOL", "TON"]),
});

export async function depositRoutes(app: FastifyInstance) {
  /** POST /api/deposits — создать заявку */
  app.post("/deposits", { preHandler: requireAuth }, async (req, reply) => {
    const parsed = CreateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const address = CRYPTO_ADDRESSES[parsed.data.crypto];
    const dep = await prisma.deposit.create({
      data: {
        userTgId: req.user!.tgId,
        amountUSD: parsed.data.amountUSD,
        crypto: parsed.data.crypto,
        address,
        status: "pending",
      },
    });
    return serialize(dep);
  });

  /** POST /api/deposits/:id/paid — юзер сообщил, что оплатил */
  app.post<{ Params: { id: string } }>("/deposits/:id/paid", { preHandler: requireAuth }, async (req, reply) => {
    const dep = await prisma.deposit.findUnique({ where: { id: req.params.id } });
    if (!dep || dep.userTgId !== req.user!.tgId) return reply.code(404).send({ error: "not_found" });
    if (dep.status !== "pending") return reply.code(400).send({ error: "wrong_status" });

    const updated = await prisma.deposit.update({
      where: { id: dep.id },
      data: { status: "awaiting", paidAt: new Date() },
    });

    const user = await prisma.user.findUnique({ where: { tgId: dep.userTgId } });
    const who = user?.username ? `@${user.username}` : user?.firstName ?? `tg:${dep.userTgId}`;
    notifyAdmins(`💰 <b>Новая заявка на пополнение</b>\n${who}\n+$${dep.amountUSD} · ${dep.crypto}`);

    return serialize(updated);
  });

  /** POST /api/deposits/:id/cancel — юзер отменил свою заявку */
  app.post<{ Params: { id: string } }>("/deposits/:id/cancel", { preHandler: requireAuth }, async (req, reply) => {
    const dep = await prisma.deposit.findUnique({ where: { id: req.params.id } });
    if (!dep || dep.userTgId !== req.user!.tgId) return reply.code(404).send({ error: "not_found" });
    if (dep.status !== "pending" && dep.status !== "awaiting") {
      return reply.code(400).send({ error: "wrong_status" });
    }
    const updated = await prisma.deposit.update({
      where: { id: dep.id },
      data: { status: "cancelled" },
    });
    return serialize(updated);
  });

  /** GET /api/deposits/me — мои депозиты */
  app.get("/deposits/me", { preHandler: requireAuth }, async (req) => {
    const list = await prisma.deposit.findMany({
      where: { userTgId: req.user!.tgId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return list.map(serialize);
  });
}

export function serialize(d: any) {
  return {
    id: d.id,
    createdAt: d.createdAt.toISOString(),
    amountUSD: d.amountUSD,
    crypto: d.crypto,
    address: d.address,
    status: d.status,
    paidAt: d.paidAt?.toISOString(),
    confirmedAt: d.confirmedAt?.toISOString(),
  };
}
