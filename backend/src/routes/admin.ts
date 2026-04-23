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
      if (order.status === "cancelled") {
        return reply.code(400).send({ error: "already_cancelled" });
      }
      // Возвращаем деньги на баланс юзера и помечаем как cancelled — атомарно.
      const updated = await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { tgId: order.userTgId },
          data: { balanceUSD: { increment: order.totalUSD } },
        });
        return tx.order.update({
          where: { id: order.id },
          data: { status: "cancelled" },
        });
      });
      try {
        const { bot } = await import("../bot.js");
        await bot.sendMessage(
          Number(order.userTgId),
          `❌ Ваш заказ #${order.id} отклонён. $${order.totalUSD.toFixed(2)} возвращены на баланс.`
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
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const startOf7d = new Date(startOfToday);
    startOf7d.setDate(startOf7d.getDate() - 6);
    const startOf30d = new Date(startOfToday);
    startOf30d.setDate(startOf30d.getDate() - 29);

    const [
      users,
      ordersAll,
      confirmedDeposits,
      depositsAll,
    ] = await Promise.all([
      prisma.user.findMany({ select: { tgId: true, createdAt: true } }),
      prisma.order.findMany({
        select: { id: true, totalUSD: true, status: true, createdAt: true, userTgId: true, items: true },
      }),
      prisma.deposit.findMany({
        where: { status: "confirmed" },
        select: { id: true, amountUSD: true, createdAt: true, confirmedAt: true, userTgId: true },
      }),
      prisma.deposit.findMany({
        select: { id: true, status: true, createdAt: true, paidAt: true, confirmedAt: true, userTgId: true },
      }),
    ]);

    const paidLikeOrders = ordersAll.filter((o) => ["paid", "in_delivery", "completed", "awaiting"].includes(o.status));
    const orderUsers = new Set(paidLikeOrders.map((o) => o.userTgId.toString()));
    const confirmedDepositUsers = new Set(confirmedDeposits.map((d) => d.userTgId.toString()));
    const activeUserIds = new Set<string>([
      ...ordersAll.map((o) => o.userTgId.toString()),
      ...depositsAll.map((d) => d.userTgId.toString()),
    ]);

    const totals = {
      users: users.length,
      activations: users.length,
      dau: countDistinctUsersSince(activeUserIdsFromRows(ordersAll, depositsAll), startOfToday),
      wau: countDistinctUsersSince(activeUserIdsFromRows(ordersAll, depositsAll), startOf7d),
      mau: countDistinctUsersSince(activeUserIdsFromRows(ordersAll, depositsAll), startOf30d),
      gmvUSD: round2(paidLikeOrders.reduce((sum, order) => sum + order.totalUSD, 0)),
      ordersToday: paidLikeOrders.filter((o) => o.createdAt >= startOfToday).length,
      avgCheckUSD: paidLikeOrders.length ? round2(paidLikeOrders.reduce((sum, order) => sum + order.totalUSD, 0) / paidLikeOrders.length) : 0,
    };

    return {
      totals,
      funnel: {
        starts: users.length,
        captchaPassed: users.length,
        miniAppOpened: users.length,
        firstOrder: orderUsers.size,
      },
      depositsFunnel: {
        created: depositsAll.length,
        paid: depositsAll.filter((d) => !!d.paidAt || d.status === "awaiting" || d.status === "confirmed").length,
        confirmed: confirmedDeposits.length,
      },
      activations7d: buildDailySeries(startOf7d, 7, (dayStart, dayEnd) => users.filter((u) => u.createdAt >= dayStart && u.createdAt < dayEnd).length),
      dau7d: buildDailySeries(startOf7d, 7, (dayStart, dayEnd) => {
        const usersInDay = new Set<string>();
        for (const order of ordersAll) {
          if (order.createdAt >= dayStart && order.createdAt < dayEnd) usersInDay.add(order.userTgId.toString());
        }
        for (const deposit of depositsAll) {
          if (deposit.createdAt >= dayStart && deposit.createdAt < dayEnd) usersInDay.add(deposit.userTgId.toString());
        }
        return usersInDay.size;
      }),
      topProducts: buildTopProducts(paidLikeOrders),
      sources: [
        { source: "telegram", users: users.length },
        { source: "buyers", users: orderUsers.size },
        { source: "depositors", users: confirmedDepositUsers.size },
        { source: "active", users: activeUserIds.size },
      ],
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

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function buildDailySeries(startDate: Date, days: number, getValue: (dayStart: Date, dayEnd: Date) => number) {
  return Array.from({ length: days }, (_, index) => {
    const dayStart = new Date(startDate);
    dayStart.setDate(startDate.getDate() + index);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    return {
      date: dayStart.toISOString().slice(5, 10),
      value: getValue(dayStart, dayEnd),
    };
  });
}

function activeUserIdsFromRows(
  orders: { userTgId: bigint; createdAt: Date }[],
  deposits: { userTgId: bigint; createdAt: Date }[]
) {
  return {
    orders,
    deposits,
  };
}

function countDistinctUsersSince(
  rows: { orders: { userTgId: bigint; createdAt: Date }[]; deposits: { userTgId: bigint; createdAt: Date }[] },
  from: Date
) {
  const ids = new Set<string>();
  for (const order of rows.orders) {
    if (order.createdAt >= from) ids.add(order.userTgId.toString());
  }
  for (const deposit of rows.deposits) {
    if (deposit.createdAt >= from) ids.add(deposit.userTgId.toString());
  }
  return ids.size;
}

function buildTopProducts(orders: { items: any; totalUSD: number }[]) {
  const stats = new Map<string, { name: string; orders: number; gmvUSD: number }>();
  for (const order of orders) {
    const items = Array.isArray(order.items) ? order.items : [];
    for (const item of items) {
      const nameValue = item?.productName ?? item?.product?.name ?? item?.name;
      const name = typeof nameValue === "string" ? nameValue : nameValue?.ru ?? nameValue?.en ?? item?.productId ?? "Товар";
      const current = stats.get(name) ?? { name, orders: 0, gmvUSD: 0 };
      current.orders += Number(item?.qty ?? 1);
      current.gmvUSD += Number(item?.priceUSD ?? 0) * Number(item?.qty ?? 1);
      stats.set(name, current);
    }
  }
  return Array.from(stats.values())
    .sort((a, b) => b.orders - a.orders || b.gmvUSD - a.gmvUSD)
    .slice(0, 5)
    .map((item) => ({ ...item, gmvUSD: round2(item.gmvUSD) }));
}
