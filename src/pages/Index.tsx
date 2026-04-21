import { useEffect, useMemo, useState } from "react";

import { Header } from "@/components/shop/Header";
import { Hero } from "@/components/shop/Hero";
import { CategoryPills } from "@/components/shop/CategoryPills";
import { ProductCard } from "@/components/shop/ProductCard";
import { CartSheet } from "@/components/shop/CartSheet";
import { StickyCartBar } from "@/components/shop/StickyCartBar";
import { SplashLanguage } from "@/components/shop/SplashLanguage";
import { LocationPicker } from "@/components/shop/LocationPicker";
import { useTelegram } from "@/lib/telegram";
import { useI18n, useT } from "@/lib/i18n";
import { useLocation } from "@/store/location";
import { useCatalog } from "@/store/catalog";
import { useAuth } from "@/store/auth";
import AdminPage from "./Admin";

const Index = () => {
  const t = useT();
  const lang = useI18n((s) => s.lang);
  const city = useLocation((s) => s.city);
  const products = useCatalog((s) => s.products);
  const categories = useCatalog((s) => s.categories);

  const { user } = useTelegram();
  const { isAdmin, loginWithTelegram, logout } = useAuth();

  // Auto-login admins by their Telegram ID. Non-whitelisted users never
  // see anything admin-related — they get the regular shop.
  useEffect(() => {
    if (user?.id) loginWithTelegram(user.id);
    // If the Telegram user changes / logs out, drop admin state
    if (!user?.id && isAdmin) logout();
  }, [user?.id, isAdmin, loginWithTelegram, logout]);

  // 🧪 TEMP: dev-only admin access for testing in the browser preview
  // (no Telegram context). Remove this block before going live.
  useEffect(() => {
    if (import.meta.env.DEV && !user?.id && !isAdmin) {
      loginWithTelegram(8044243116);
    }
  }, [user?.id, isAdmin, loginWithTelegram]);

  const [category, setCategory] = useState<string>("all");
  const [cartOpen, setCartOpen] = useState(false);
  const [showLocPicker, setShowLocPicker] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);

  const cityProducts = useMemo(
    () =>
      city
        ? products.filter((p) => !p.cities || p.cities.length === 0 || p.cities.includes(city))
        : products,
    [products, city]
  );

  const featured = useMemo(
    () => cityProducts.find((p) => p.featured) ?? cityProducts[0],
    [cityProducts]
  );

  const filtered = useMemo(
    () => (category === "all" ? cityProducts : cityProducts.filter((p) => p.category === category)),
    [cityProducts, category]
  );

  // Admins open the shop by default and switch to the admin panel via the header button.
  if (isAdmin && showAdmin) return <AdminPage onExit={() => setShowAdmin(false)} />;

  if (!lang) return <SplashLanguage onPicked={() => {}} />;
  if (!city || showLocPicker)
    return (
      <LocationPicker
        showBack={!!city}
        onBack={() => setShowLocPicker(false)}
        onPicked={() => setShowLocPicker(false)}
      />
    );

  return (
    <div className="min-h-screen max-w-md mx-auto bg-background">
      <Header
        onCartClick={() => setCartOpen(true)}
        onLocationClick={() => setShowLocPicker(true)}
        showAdminButton={isAdmin}
        onAdminClick={() => setShowAdmin(true)}
      />

      <main className="pb-32">
        {featured && <Hero product={featured} />}

        <CategoryPills categories={categories} active={category} onChange={setCategory} />

        <section className="px-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-bold text-xl">
              {category === "all" ? t("section.allProducts") : t("section.category")}
            </h2>
            <span className="text-xs text-muted-foreground">
              {filtered.length} {t("section.count")}
            </span>
          </div>

          {filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <div className="text-5xl mb-2">🌸</div>
              {t("section.empty")}
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
      <CartSheet
        open={cartOpen}
        onOpenChange={setCartOpen}
        onCheckout={() => {
          setCartOpen(false);
          alert("Checkout — next step 🙂");
        }}
      />
    </div>
  );
};

export default Index;
