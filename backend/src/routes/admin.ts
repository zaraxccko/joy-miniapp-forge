import { FastifyInstance } from "fastify";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { prisma } from "../db.js";
import { requireAdmin } from "../auth/middleware.js";
import { env } from "../env.js";
import { broadcast } from "../bot.js";
import { serializeProduct } from "./catalog.js";
import { serialize as serializeOrder } from "./orders.js";
import { serialize as serializeDeposit } from "./deposits.js";

export async function adminRoutes(app: FastifyInstance) {
  // ==================================================================
  // ===================== AWAITING / HISTORY =========================
  // ==================================================================

  app.get("/admin/awaiting", { preHandler: requireAdmin }, async () => {
    const [orders, deposits] = await Promise.all([
      prisma.order.findMany({
        where: { status: "awaiting" },
        orderBy: { createdAt: "desc" },
        include: { user: true },
      }),
      prisma.deposit.findMany({
        where: { status: "awaiting" },
        orderBy: { createdAt: "desc" },
        include: { user: true },
      }),
    ]);
    return {
      orders: orders.map((o) => ({ ...serializeOrder(o), customer: customerOf(o.user) })),
      deposits: deposits.map((d) => ({ ...serializeDeposit(d), customer: customerOf(d.user) })),
    };
  });

  app.get<{ Querystring: { limit?: string; offset?: string } }>(
    "/admin/history",
    { preHandler: requireAdmin },
    async (req) => {
      const limit = Math.min(Number(req.query.limit ?? 50), 200);
      const offset = Number(req.query.offset ?? 0);
      const [orders, deposits] = await Promise.all([
        prisma.order.findMany({
          where: { status: { not: "awaiting" } },
          orderBy: { createdAt: "desc" },
          take: limit,
          skip: offset,
          include: { user: true },
        }),
        prisma.deposit.findMany({
          where: { status: { in: ["confirmed", "cancelled"] } },
          orderBy: { createdAt: "desc" },
          take: limit,
          skip: offset,
          include: { user: true },
        }),
      ]);
      return {
        orders: orders.map((o) => ({ ...serializeOrder(o), customer: customerOf(o.user) })),
        deposits: deposits.map((d) => ({ ...serializeDeposit(d), customer: customerOf(d.user) })),
      };
    }
  );

  // ==================================================================
  // ============== DEPOSIT CONFIRM / CANCEL =========================
  // ==================================================================

  app.post<{ Params: { id: string } }>(
    "/admin/deposits/:id/confirm",
    { preHandler: requireAdmin },
    async (req, reply) => {
      const dep = await prisma.deposit.findUnique({ where: { id: req.params.id } });
      if (!dep) return reply.code(404).send({ error: "not_found" });
      if (dep.status !== "awaiting" && dep.status !== "pending") {
        return reply.code(400).send({ error: "wrong_status" });
      }
      const updated = await prisma.$transaction(async (tx) => {
        const u = await tx.deposit.update({
          where: { id: dep.id },
          data: { status: "confirmed", confirmedAt: new Date() },
        });
        await tx.user.update({
          where: { tgId: dep.userTgId },
          data: { balanceUSD: { increment: dep.amountUSD } },
        });
        return u;
      });
      // нотификация юзеру
      try {
        const { bot } = await import("../bot.js");
        await bot.sendMessage(
          Number(dep.userTgId),
          `✅ Пополнение на $${dep.amountUSD} (${dep.crypto}) зачислено на баланс.`
        );
      } catch {}
      return serializeDeposit(updated);
    }
  );

  app.post<{ Params: { id: string } }>(
    "/admin/deposits/:id/cancel",
    { preHandler: requireAdmin },
    async (req, reply) => {
      const dep = await prisma.deposit.findUnique({ where: { id: req.params.id } });
      if (!dep) return reply.code(404).send({ error: "not_found" });
      const updated = await prisma.deposit.update({
        where: { id: dep.id },
        data: { status: "cancelled" },
      });
      try {
        const { bot } = await import("../bot.js");
        await bot.sendMessage(Number(dep.userTgId), `❌ Пополнение на $${dep.amountUSD} отклонено.`);
      } catch {}
      return serializeDeposit(updated);
    }
  );

  // ==================================================================
  // ============== ORDER CONFIRM / CANCEL ===========================
  // ==================================================================

  /**
   * POST /api/admin/orders/:id/confirm
   * multipart/form-data: photo (file, optional), text (string, optional)
   */
  app.post<{ Params: { id: string } }>(
    "/admin/orders/:id/confirm",
    { preHandler: requireAdmin },
    async (req, reply) => {
      const order = await prisma.order.findUnique({ where: { id: req.params.id } });
      if (!order) return reply.code(404).send({ error: "not_found" });

      let photoUrl: string | undefined;
      let text: string | undefined;

      const parts = req.parts();
      for await (const part of parts) {
        if (part.type === "file" && part.fieldname === "photo") {
          await fs.mkdir(env.uploadDir, { recursive: true });
          const ext = path.extname(part.filename || "") || ".jpg";
          const name = `${Date.now()}_${crypto.randomBytes(6).toString("hex")}${ext}`;
          const fullPath = path.join(env.uploadDir, name);
          const buf = await part.toBuffer();
          await fs.writeFile(fullPath, buf);
          photoUrl = `${env.publicUploadUrl.replace(/\/$/, "")}/${name}`;
        } else if (part.type === "field" && part.fieldname === "text") {
          text = String(part.value).slice(0, 4000);
        }
      }

      const updated = await prisma.order.update({
        where: { id: order.id },
        data: {
          status: "completed",
          confirmPhotoUrl: photoUrl,
          confirmText: text,
          confirmedAt: new Date(),
        },
      });

      try {
        const { bot } = await import("../bot.js");
        const caption = `✅ Ваш заказ #${order.id} подтверждён.${text ? "\n\n" + text : ""}`;
        if (photoUrl) {
          await bot.sendPhoto(Number(order.userTgId), photoUrl, { caption });
        } else {
          await bot.sendMessage(Number(order.userTgId), caption);
        }
      } catch {}

      return serializeOrder(updated);
    }
  );

  app.post<{ Params: { id: string } }>(
    "/admin/orders/:id/cancel",
    { preHandler: requireAdmin },
    async (req, reply) => {
      const order = await prisma.order.findUnique({ where: { id: req.params.id } });
      if (!order) return reply.code(404).send({ error: "not_found" });
      // возвращаем баланс
      const updated = await prisma.$transaction(async (tx) => {
        const u = await tx.order.update({
          where: { id: order.id },
          data: { status: "cancelled" },
        });
        if (order.status === "awaiting" || order.status === "paid") {
          await tx.user.update({
            where: { tgId: order.userTgId },
            data: { balanceUSD: { increment: order.totalUSD } },
          });
        }
        return u;
      });
      try {
        const { bot } = await import("../bot.js");
        await bot.sendMessage(
          Number(order.userTgId),
          `❌ Ваш заказ #${order.id} отклонён. Баланс возвращён.`
        );
      } catch {}
      return serializeOrder(updated);
    }
  );

  // ==================================================================
  // ============== PRODUCTS CRUD ====================================
  // ==================================================================

  const optionalString = (max: number) =>
    z.preprocess((value) => {
      if (typeof value !== "string") return value;
      const trimmed = value.trim();
      return trimmed === "" ? undefined : trimmed;
    }, z.string().max(max).optional());

  const optionalImageUrl = z.preprocess((value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  }, z.string().max(2_000_000).refine((value) => {
    if (value.startsWith("data:image/")) return true;
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }, "Invalid image URL").optional());

  const ProductInput = z.object({
    name: z.union([z.string(), z.object({ ru: z.string(), en: z.string() })]),
    description: z.union([z.string(), z.object({ ru: z.string(), en: z.string() })]),
    category: z.string().min(1).max(64),
    priceTHB: z.number().nonnegative().optional(),
    thcMg: z.number().int().optional(),
    cbdMg: z.number().int().optional(),
    weight: optionalString(32),
    inStock: z.number().int().nonnegative().optional(),
    gradient: z.string().optional(),
    emoji: z.string().max(8).optional(),
    imageUrl: optionalImageUrl,
    featured: z.boolean().optional(),
    badge: z.any().optional(),
    cities: z.array(z.string()).max(100).optional(),
    districts: z.array(z.string()).max(500).optional(),
    variants: z
      .array(
        z.object({
          slug: z.string().min(1).max(32),
          grams: z.number().positive(),
          pricesByCountry: z.record(z.string(), z.number().nonnegative()),
          stashes: z
            .array(
              z.object({
                districtSlug: z.string(),
                type: z.enum(["prikop", "klad", "magnit"]),
              })
            )
            .optional(),
          districts: z.array(z.string()).optional(),
        })
      )
      .optional(),
  });

  app.post("/admin/products", { preHandler: requireAdmin }, async (req, reply) => {
    const parsed = ProductInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { variants = [], ...data } = parsed.data;
    const created = await prisma.product.create({
      data: {
        ...data,
        name: data.name as any,
        description: data.description as any,
        cities: data.cities ?? [],
        districts: data.districts ?? [],
        variants: {
          create: variants.map((v) => ({
            slug: v.slug,
            grams: v.grams,
            pricesByCountry: v.pricesByCountry,
            stashes: (v.stashes ?? []) as any,
            districts: v.districts ?? [],
          })),
        },
      },
      include: { variants: true },
    });
    return serializeProduct(created);
  });

  app.put<{ Params: { id: string } }>(
    "/admin/products/:id",
    { preHandler: requireAdmin },
    async (req, reply) => {
      const parsed = ProductInput.partial().safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
      const { variants, ...data } = parsed.data;
      const updated = await prisma.$transaction(async (tx) => {
        await tx.product.update({
          where: { id: req.params.id },
          data: {
            ...data,
            name: data.name as any,
            description: data.description as any,
          },
        });
        if (variants) {
          await tx.variant.deleteMany({ where: { productId: req.params.id } });
          await tx.variant.createMany({
            data: variants.map((v) => ({
              productId: req.params.id,
              slug: v.slug,
              grams: v.grams,
              pricesByCountry: v.pricesByCountry as any,
              stashes: (v.stashes ?? []) as any,
              districts: v.districts ?? [],
            })),
          });
        }
        return tx.product.findUnique({
          where: { id: req.params.id },
          include: { variants: true },
        });
      });
      return serializeProduct(updated);
    }
  );

  app.delete<{ Params: { id: string } }>(
    "/admin/products/:id",
    { preHandler: requireAdmin },
    async (req) => {
      await prisma.product.delete({ where: { id: req.params.id } });
      return { ok: true };
    }
  );

  // ==================================================================
  // ============== ANALYTICS ========================================
  // ==================================================================

  app.get("/admin/analytics", { preHandler: requireAdmin }, async () => {
    const [usersCount, ordersAgg, depositsAgg] = await Promise.all([
      prisma.user.count(),
      prisma.order.aggregate({
        _sum: { totalUSD: true },
        _count: true,
        where: { status: { in: ["paid", "in_delivery", "completed"] } },
      }),
      prisma.deposit.aggregate({
        _sum: { amountUSD: true },
        _count: true,
        where: { status: "confirmed" },
      }),
    ]);
    return {
      users: usersCount,
      ordersTotal: ordersAgg._count,
      ordersRevenue: ordersAgg._sum.totalUSD ?? 0,
      depositsTotal: depositsAgg._count,
      depositsAmount: depositsAgg._sum.amountUSD ?? 0,
    };
  });

  // ==================================================================
  // ============== BROADCAST ========================================
  // ==================================================================

  const BroadcastSchema = z.object({
    segment: z.enum(["all", "active", "inactive"]).default("all"),
    text: z.string().min(1).max(4000),
    image: z.string().url().nullish(),
    button: z
      .object({
        text: z.string().min(1).max(64),
        url: z.string().url().max(2048),
      })
      .nullish(),
  });

  app.post("/broadcast", { preHandler: requireAdmin }, async (req, reply) => {
    const parsed = BroadcastSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const { segment, text, image, button } = parsed.data;
    const where =
      segment === "active"
        ? { orders: { some: {} } }
        : segment === "inactive"
        ? { orders: { none: {} } }
        : {};
    const users = await prisma.user.findMany({ where, select: { tgId: true } });
    const recipients = users.map((u) => Number(u.tgId));

    const log = await prisma.broadcastLog.create({
      data: {
        segment,
        text,
        imageUrl: image ?? undefined,
        button: button ?? undefined,
      },
    });

    // отправляем в фоне, не блокируя ответ
    (async () => {
      const result = await broadcast({
        recipients,
        text,
        imageUrl: image ?? undefined,
        button: button ?? undefined,
      });
      await prisma.broadcastLog.update({
        where: { id: log.id },
        data: { sentCount: result.sent, failedCount: result.failed },
      });
    })().catch(() => undefined);

    return { queued: recipients.length, logId: log.id };
  });
}

function customerOf(u: any) {
  if (!u) return undefined;
  const name =
    u.firstName || u.lastName
      ? [u.firstName, u.lastName].filter(Boolean).join(" ")
      : undefined;
  return {
    tgId: u.tgId.toString(),
    name,
    username: u.username ?? undefined,
  };
}
