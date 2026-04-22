import { FastifyInstance } from "fastify";
import { prisma } from "../db.js";

export async function catalogRoutes(app: FastifyInstance) {
  /**
   * GET /api/catalog
   * Открытый эндпоинт. Фронт сам фильтрует по городу/району,
   * либо можно передать ?city=slug чтобы получить только то, что разрешено.
   */
  app.get<{ Querystring: { city?: string } }>("/catalog", async (req) => {
    const city = req.query.city;
    const products = await prisma.product.findMany({
      include: { variants: true },
      orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
    });

    const filtered = city
      ? products.filter((p) => p.cities.length === 0 || p.cities.includes(city))
      : products;

    return filtered.map(serializeProduct);
  });

  /**
   * GET /api/categories
   * Возвращает уникальные категории, использованные в товарах.
   */
  app.get("/categories", async () => {
    const rows = await prisma.product.findMany({ select: { category: true }, distinct: ["category"] });
    return rows.map((r) => r.category);
  });
}

export function serializeProduct(p: any) {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    category: p.category,
    priceTHB: p.priceTHB,
    thcMg: p.thcMg ?? undefined,
    cbdMg: p.cbdMg ?? undefined,
    weight: p.weight ?? undefined,
    inStock: p.inStock,
    gradient: p.gradient,
    emoji: p.emoji,
    imageUrl: p.imageUrl ?? undefined,
    featured: p.featured,
    badge: p.badge ?? undefined,
    cities: p.cities,
    districts: p.districts,
    variants: (p.variants ?? []).map((v: any) => ({
      id: v.slug,
      grams: v.grams,
      pricesByCountry: v.pricesByCountry,
      stashes: v.stashes,
      districts: v.districts,
    })),
  };
}
