import type { Product } from "@/types/shop";
import { formatTHB } from "@/lib/format";
import { useI18n, useT } from "@/lib/i18n";
import { loc } from "@/lib/loc";

interface HeroProps {
  product: Product;
  onClick?: () => void;
}

export const Hero = ({ product, onClick }: HeroProps) => {
  const t = useT();
  const lang = useI18n((s) => s.lang) ?? "ru";
  return (
    <button
      onClick={onClick}
      className="mx-5 mb-5 block w-[calc(100%-2.5rem)] text-left rounded-3xl gradient-hero p-5 relative overflow-hidden shadow-soft active:scale-[0.99] transition-[var(--transition-base)]"
    >
      <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full bg-white/30 blur-2xl" />
      {product.imageUrl ? (
        <img
          src={product.imageUrl}
          alt=""
          className="absolute -right-4 -bottom-4 w-36 h-36 object-cover rounded-3xl opacity-90"
        />
      ) : (
        <div className="absolute -right-2 bottom-0 text-[100px] leading-none opacity-90 select-none">
          {product.emoji}
        </div>
      )}
      <div className="relative">
        <div className="text-[11px] font-semibold uppercase tracking-widest text-foreground/70 mb-1">
          {t("hero.pickOfDay")}
        </div>
        <div className="font-display text-[22px] font-bold leading-tight text-foreground max-w-[60%]">
          {loc(product.name, lang)}
        </div>
        <div className="flex items-center gap-2 mt-3">
          <span className="bg-card/90 backdrop-blur text-foreground text-xs font-bold px-3 py-1.5 rounded-full">
            {formatTHB(product.priceTHB)}
          </span>
          {product.thcMg && (
            <span className="bg-foreground/90 text-background text-xs font-semibold px-2.5 py-1.5 rounded-full">
              THC {product.thcMg}mg
            </span>
          )}
        </div>
      </div>
    </button>
  );
};
