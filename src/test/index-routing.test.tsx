import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Index from "@/pages/Index";
import { useI18n } from "@/lib/i18n";
import { useLocation } from "@/store/location";
import { useCaptcha } from "@/store/captcha";
import { useCatalog } from "@/store/catalog";
import { useSession } from "@/store/session";
import { useAccount } from "@/store/account";
import { useCart } from "@/store/cart";

vi.mock("@/lib/telegram", () => ({
  haptic: vi.fn(),
  useTelegram: () => ({ user: null, tg: null, isInTelegram: false }),
}));

vi.mock("@/store/auth", () => ({
  useAuth: () => ({ isAdmin: false }),
}));

vi.mock("@/components/shop/Header", () => ({
  Header: ({ onAccountClick }: { onAccountClick?: () => void }) => (
    <button onClick={onAccountClick}>open-account</button>
  ),
}));

vi.mock("@/components/shop/CartSheet", () => ({
  CartSheet: ({ onCheckout }: { onCheckout: () => void }) => (
    <button onClick={onCheckout}>checkout-order</button>
  ),
}));

vi.mock("@/components/shop/AccountPage", () => ({
  AccountPage: ({
    onTopUp,
    onOpenActiveOrder,
  }: {
    onTopUp: () => void;
    onOpenActiveOrder: () => void;
  }) => (
    <div>
      <button onClick={onTopUp}>go-topup</button>
      <button onClick={onOpenActiveOrder}>go-active-order</button>
    </div>
  ),
}));

vi.mock("@/components/shop/DepositPage", () => ({
  DepositPage: () => <div>deposit-screen</div>,
}));

vi.mock("@/components/shop/OrderPaymentPage", () => ({
  OrderPaymentPage: () => <div>order-payment-screen</div>,
}));

vi.mock("@/components/shop/Hero", () => ({ Hero: () => null }));
vi.mock("@/components/shop/CategoryPills", () => ({ CategoryPills: () => null }));
vi.mock("@/components/shop/ProductCard", () => ({ ProductCard: () => null }));
vi.mock("@/components/shop/StickyCartBar", () => ({ StickyCartBar: () => null }));
vi.mock("@/components/shop/ProductSheet", () => ({ ProductSheet: () => null }));
vi.mock("@/components/shop/SplashLanguage", () => ({ SplashLanguage: () => <div>language-screen</div> }));
vi.mock("@/components/shop/LocationPicker", () => ({ LocationPicker: () => <div>location-screen</div> }));
vi.mock("@/components/shop/CaptchaGate", () => ({ CaptchaGate: () => <div>captcha-screen</div> }));
vi.mock("@/pages/Admin", () => ({ default: () => <div>admin-screen</div> }));

const mockCartLine = {
  product: {
    id: "product-1",
    name: { ru: "Товар", en: "Product" },
    description: { ru: "", en: "" },
    category: "all",
    priceTHB: 100,
    gradient: "gradient-primary",
    emoji: "✨",
    cities: [],
    districts: [],
    variants: [],
  },
  qty: 1,
  variantId: "1g",
  districtSlug: "district-1",
  stashType: "prikop",
  priceUSD: 100,
};

describe("Index routing for top-up vs order payment", () => {
  beforeEach(() => {
    useI18n.setState({ lang: "ru" });
    useLocation.setState({ city: "bali" });
    useCaptcha.setState({ passed: true });
    useCatalog.setState({ products: [], categories: [], loading: false, loaded: true });
    useSession.setState({
      user: null,
      loading: false,
      error: null,
      loginWithInitData: vi.fn().mockResolvedValue(null),
      refreshMe: vi.fn().mockResolvedValue(undefined),
      logout: vi.fn(),
    });
    useAccount.setState({ hydrate: vi.fn().mockResolvedValue(undefined) });
    useCart.setState({
      lines: [mockCartLine],
      delivery: false,
      deliveryAddress: "",
      cartId: "ORD-TEST",
      reservedAt: Date.now(),
    });
  });

  it("opens order payment from cart checkout instead of deposit", () => {
    render(<Index />);

    fireEvent.click(screen.getByText("checkout-order"));

    expect(screen.getByText("order-payment-screen")).toBeInTheDocument();
    expect(screen.queryByText("deposit-screen")).not.toBeInTheDocument();
  });

  it("opens deposit only from the balance top-up action", () => {
    render(<Index />);

    fireEvent.click(screen.getByText("open-account"));
    fireEvent.click(screen.getByText("go-topup"));

    expect(screen.getByText("deposit-screen")).toBeInTheDocument();
    expect(screen.queryByText("order-payment-screen")).not.toBeInTheDocument();
  });

  it("opens order payment from active order action in account", () => {
    render(<Index />);

    fireEvent.click(screen.getByText("open-account"));
    fireEvent.click(screen.getByText("go-active-order"));

    expect(screen.getByText("order-payment-screen")).toBeInTheDocument();
    expect(screen.queryByText("deposit-screen")).not.toBeInTheDocument();
  });
});