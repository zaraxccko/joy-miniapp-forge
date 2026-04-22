import { FastifyReply, FastifyRequest } from "fastify";
import { isAdminTgId } from "./telegram.js";

declare module "fastify" {
  interface FastifyRequest {
    user?: { tgId: bigint; isAdmin: boolean };
  }
}

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  try {
    const decoded = (await req.jwtVerify()) as unknown as { tgId: string | number };
    if (!decoded || typeof decoded !== "object" || !("tgId" in decoded)) {
      return reply.code(401).send({ error: "unauthorized" });
    }
    const tgId = BigInt(decoded.tgId);
    req.user = { tgId, isAdmin: isAdminTgId(tgId) };
  } catch {
    return reply.code(401).send({ error: "unauthorized" });
  }
}

export async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  await requireAuth(req, reply);
  if (reply.sent) return;
  if (!req.user?.isAdmin) {
    return reply.code(403).send({ error: "forbidden" });
  }
}
