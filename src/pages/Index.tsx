import { useMemo, useState } from "react";
import { Header } from "@/components/shop/Header";
import { Hero } from "@/components/shop/Hero";
import { CategoryPills } from "@/components/shop/CategoryPills";
import { ProductCard } from "@/components/shop/ProductCard";
import { CartSheet } from "@/components/shop/CartSheet";
import { StickyCartBar } from "@/components/shop/StickyCartBar";
import { PRODUCTS } from "@/data/mockProducts";
import { useTelegram } from "@/lib/telegram";
import type { CategorySlug } from "@/types/shop";

const Index = () => {
  useTelegram(); // initialize TG WebApp if available
  const [category, setCategory] = useState<CategorySlug>("all");
  const [cartOpen, setCartOpen] = useState(false);

  const featured = useMemo(() => PRODUCTS.find((p) => p.featured) ?? PRODUCTS[0], []);
  const filtered = useMemo(
    () => (category === "all" ? PRODUCTS : PRODUCTS.filter((p) => p.category === category)),
    [category]
  );

  const handleCheckout = () => {
    setCartOpen(false);
    // TODO: navigate to /checkout — добавим на следующем шаге
    alert("Чекаут будет добавлен на следующем шаге 🙂");
  };

  return (
    <div className="min-h-screen max-w-md mx-auto bg-background">
      <Header onCartClick={() => setCartOpen(true)} />

      <main className="pb-32">
        <Hero product={featured} />

        <CategoryPills active={category} onChange={setCategory} />

        <section className="px-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-bold text-xl">
              {category === "all" ? "Все товары" : "Категория"}
            </h2>
            <span className="text-xs text-muted-foreground">{filtered.length} товаров</span>
          </div>

          {filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <div className="text-5xl mb-2">🌸</div>
              Здесь пока пусто
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filtered.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </section>
      </main>

      <StickyCartBar onClick={() => setCartOpen(true)} />
      <CartSheet open={cartOpen} onOpenChange={setCartOpen} onCheckout={handleCheckout} />
    </div>
  );
};

export default Index;
