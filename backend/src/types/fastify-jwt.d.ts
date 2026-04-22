import "@fastify/jwt";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { tgId: string };
    user: { tgId: string };
  }
}
