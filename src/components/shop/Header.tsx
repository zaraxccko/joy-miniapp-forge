import { ShoppingBag, MapPin } from "lucide-react";
import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "@/store/cart";
import { haptic } from "@/lib/telegram";
import { useI18n, useT, type Lang } from "@/lib/i18n";
import { useLocation } from "@/store/location";
import { findCity } from "@/data/locations";
import logo from "@/assets/logo.webp";

interface HeaderProps {
  onCartClick: () => void;
  onLocationClick: () => void;
}

const TAPS_REQUIRED = 7;
const TAP_WINDOW_MS = 3000;

export const Header = ({ onCartClick, onLocationClick }: HeaderProps) => {
  const totalQty = useCart((s) => s.totalQty());
  const t = useT();
  const lang = useI18n((s) => s.lang) ?? "ru";
  const setLang = useI18n((s) => s.setLang);
  const city = useLocation((s) => s.city);
  const found = city ? findCity(city) : null;
  const navigate = useNavigate();
  const tapsRef = useRef<number[]>([]);

  const handleLogoTap = () => {
    const now = Date.now();
    tapsRef.current = [...tapsRef.current.filter((t) => now - t < TAP_WINDOW_MS), now];
    if (tapsRef.current.length >= TAPS_REQUIRED) {
      tapsRef.current = [];
      haptic("success");
      navigate("/_lsadmin_x9k2");
    }
  };

  return (
    <header className="sticky top-0 z-30 px-5 pt-5 pb-3 bg-background/80 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <img
            src={logo}
            alt="Love Shop"
            width={44}
            height={44}
            loading="eager"
            decoding="async"
            // @ts-expect-error fetchpriority is a valid HTML attribute
            fetchpriority="high"
            onClick={handleLogoTap}
            className="w-11 h-11 rounded-2xl object-cover shadow-soft shrink-0 cursor-pointer select-none"
          />
          <div className="min-w-0">
            <div className="font-display font-bold text-lg leading-none truncate">Love Shop</div>
            <button
              onClick={() => {
                haptic("light");
                onLocationClick();
              }}
              className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1 active:scale-95"
            >
              <MapPin className="w-3 h-3 text-primary" />
              {found ? (
                <>
                  <span className="font-semibold text-foreground">
                    {found.country.flag} {found.city.name[lang]}
                  </span>
                  <span>· {t("header.openTill")}</span>
                </>
              ) : (
                <span>{t("loc.pickCountry")}</span>
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => {
              haptic("light");
              setLang((lang === "ru" ? "en" : "ru") as Lang);
            }}
            className="h-11 px-3 rounded-2xl bg-card shadow-card font-bold text-xs active:scale-95 transition-[var(--transition-base)]"
            aria-label="Language"
          >
            {lang === "ru" ? "RU" : "EN"}
          </button>
          <button
            onClick={() => {
              haptic("light");
              onCartClick();
            }}
            className="relative w-11 h-11 rounded-2xl bg-card shadow-card flex items-center justify-center active:scale-95 transition-[var(--transition-base)]"
            aria-label="Cart"
          >
            <ShoppingBag className="w-5 h-5 text-foreground" />
            {totalQty > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 gradient-primary text-primary-foreground text-[11px] font-bold rounded-full flex items-center justify-center shadow-glow animate-pop">
                {totalQty}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
