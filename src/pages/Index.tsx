import { useEffect, useMemo, useState } from "react";

import { Header } from "@/components/shop/Header";
import { Hero } from "@/components/shop/Hero";
import { CategoryPills } from "@/components/shop/CategoryPills";
import { ProductCard } from "@/components/shop/ProductCard";
import { CartSheet } from "@/components/shop/CartSheet";
import { StickyCartBar } from "@/components/shop/StickyCartBar";
import { SplashLanguage } from "@/components/shop/SplashLanguage";
import { LocationPicker } from "@/components/shop/LocationPicker";
import { ProductSheet } from "@/components/shop/ProductSheet";
import { DepositPage } from "@/components/shop/DepositPage";
import { AccountPage } from "@/components/shop/AccountPage";
import { OrderPaymentPage } from "@/components/shop/OrderPaymentPage";
import { CaptchaGate } from "@/components/shop/CaptchaGate";
import { useCaptcha } from "@/store/captcha";
import { useTelegram } from "@/lib/telegram";
import { useI18n, useT } from "@/lib/i18n";
import { useLocation } from "@/store/location";
import { useCatalog } from "@/store/catalog";
import { useAuth } from "@/store/auth";
import { useAccount } from "@/store/account";
import { useCart } from "@/store/cart";
import { findCity } from "@/data/locations";
import { toast } from "sonner";
import type { Product } from "@/types/shop";
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
  // 🧪 In dev (browser preview without Telegram) we auto-login as the
  //    primary admin ID so the shield button is visible for testing.
  useEffect(() => {
    if (user?.id) {
      loginWithTelegram(user.id);
    } else {
      // ⚠️ ВРЕМЕННО: автологин админа в превью (без Telegram).
      // Убери эту ветку перед продакшеном.
      loginWithTelegram(8044243116);
    }
  }, [user?.id, loginWithTelegram]);

  const [category, setCategory] = useState<string>("all");
  const [cartOpen, setCartOpen] = useState(false);
  const [showLocPicker, setShowLocPicker] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [openProduct, setOpenProduct] = useState<Product | null>(null);
  const [showAccount, setShowAccount] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [depositSuggested, setDepositSuggested] = useState<number | undefined>(undefined);
  const [orderPayOpen, setOrderPayOpen] = useState(false);

  const balance = useAccount((s) => s.balanceUSD);
  const spend = useAccount((s) => s.spend);
  const addOrder = useAccount((s) => s.addOrder);
  const cartLines = useCart((s) => s.lines);
  const cartTotal = useCart((s) => s.totalTHB());
  const cartDelivery = useCart((s) => s.delivery);
  const cartAddress = useCart((s) => s.deliveryAddress);
  const clearCart = useCart((s) => s.clear);
  const captchaPassed = useCaptcha((s) => s.passed);

  const handleCheckout = () => {
    if (cartLines.length === 0) return;
    if (cartDelivery && !cartAddress.trim()) {
      toast.error(lang === "en" ? "Please enter delivery address" : "Укажите адрес доставки");
      return;
    }
    if (balance < cartTotal) {
      const shortfall = Math.max(0, cartTotal - balance);
      setDepositSuggested(shortfall);
      setCartOpen(false);
      setDepositOpen(true);
      toast(
        lang === "en"
          ? `Top up $${shortfall} to complete the order`
          : `Пополните баланс на $${shortfall} для оформления`
      );
      return;
    }
    if (!spend(cartTotal)) {
      toast.error(lang === "en" ? "Not enough balance" : "Недостаточно средств");
      return;
    }
    addOrder({
      totalUSD: cartTotal,
      items: cartLines,
      delivery: cartDelivery,
      deliveryAddress: cartDelivery ? cartAddress : undefined,
    });
    clearCart();
    setCartOpen(false);
    toast.success(lang === "en" ? "Order placed!" : "Заказ оформлен!");
    setShowAccount(true);
  };

  const cityInfo = city ? findCity(city) : null;

  const cityProducts = useMemo(() => {
    if (!city || !cityInfo) return products;
    const cityDistrictSlugs = new Set(
      (cityInfo.city.districts ?? []).map((d) => d.slug)
    );
    const countrySlug = cityInfo.country.slug;
    return products.filter((p) => {
      // Must allow this city
      if (p.cities && p.cities.length > 0 && !p.cities.includes(city)) return false;
      const variants = p.variants ?? [];
      // No variants yet → show by city allowlist (freshly created products).
      if (variants.length === 0) return true;
      // Has variants → at least one must be priced for this country.
      // If a variant has no district/stash info, treat it as available city-wide.
      return variants.some((v) => {
        if (!v.pricesByCountry?.[countrySlug]) return false;
        const variantDistricts = [
          ...(v.districts ?? []),
          ...((v.stashes ?? []).map((s) => s.districtSlug)),
        ];
        if (variantDistricts.length === 0) return true;
        if (cityDistrictSlugs.size === 0) return true;
        return variantDistricts.some((d) => cityDistrictSlugs.has(d));
      });
    });
  }, [products, city, cityInfo]);

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
  // Captcha gate — admins тоже проходят (защита от ботов на входе).
  if (!captchaPassed) return <CaptchaGate />;
  if (!city || showLocPicker)
    return (
      <LocationPicker
        showBack={!!city}
        onBack={() => setShowLocPicker(false)}
        onPicked={() => setShowLocPicker(false)}
      />
    );

  if (depositOpen)
    return (
      <DepositPage
        suggested={depositSuggested}
        onBack={() => { setDepositOpen(false); setDepositSuggested(undefined); }}
        onDone={() => {
          setDepositOpen(false);
          setDepositSuggested(undefined);
          setShowAccount(true);
        }}
      />
    );

  if (orderPayOpen)
    return (
      <OrderPaymentPage
        onBack={() => setOrderPayOpen(false)}
        onPaid={() => { setOrderPayOpen(false); setShowAccount(true); }}
      />
    );

  if (showAccount)
    return (
      <AccountPage
        onBack={() => setShowAccount(false)}
        onTopUp={() => { setShowAccount(false); setDepositSuggested(undefined); setDepositOpen(true); }}
        onOpenCart={() => { setShowAccount(false); setCartOpen(true); }}
        onOpenActiveOrder={() => { setShowAccount(false); setOrderPayOpen(true); }}
      />
    );

  return (
    <div className="min-h-screen max-w-md mx-auto bg-background">
      <Header
        onCartClick={() => setCartOpen(true)}
        onLocationClick={() => setShowLocPicker(true)}
        showAdminButton={isAdmin}
        onAdminClick={() => setShowAdmin(true)}
        onAccountClick={() => setShowAccount(true)}
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
              <div className="text-5xl font-display font-bold mb-2">404</div>
              {t("section.empty")}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filtered.map((p) => (
                <ProductCard key={p.id} product={p} onOpen={setOpenProduct} />
              ))}
            </div>
          )}

        </section>
      </main>

      <StickyCartBar onClick={() => setCartOpen(true)} />
      <CartSheet
        open={cartOpen}
        onOpenChange={setCartOpen}
        onCheckout={handleCheckout}
      />
      <ProductSheet
        product={openProduct}
        onOpenChange={(o) => !o && setOpenProduct(null)}
      />
    </div>
  );
};

export default Index;
