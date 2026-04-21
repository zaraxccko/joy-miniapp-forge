import type { Product } from "@/types/shop";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { loc } from "@/lib/loc";

interface ProductCardProps {
  product: Product;
  onOpen?: (p: Product) => void;
}

export const ProductCard = ({ product, onOpen }: ProductCardProps) => {
  const lang = useI18n((s) => s.lang) ?? "ru";
  const name = loc(product.name, lang);

  return (
    <div className="bg-card rounded-3xl overflow-hidden shadow-card animate-fade-in flex flex-col">
      <button
        onClick={() => onOpen?.(product)}
        className={cn(
          "aspect-square relative flex items-center justify-center overflow-hidden",
          !product.imageUrl && product.gradient
        )}
      >
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="text-[64px] drop-shadow-sm select-none">{product.emoji}</span>
        )}
        {product.badge && (
          <span className="absolute top-2 right-2 bg-card text-primary text-[10px] font-bold px-2 py-1 rounded-full shadow-card">
            {loc(product.badge, lang)}
          </span>
        )}
      </button>
      <div className="p-3 flex-1 flex flex-col">
        <button
          onClick={() => onOpen?.(product)}
          className="text-left active:opacity-70 transition-opacity"
        >
          <div className="text-[13px] font-semibold leading-tight line-clamp-2 min-h-[2.4em]">
            {name}
          </div>
          <div className="text-[11px] text-primary mt-0.5 font-medium flex items-center gap-1">
            {lang === "ru" ? "Подробнее" : "View details"}
            <span aria-hidden>→</span>
          </div>
        </button>
      </div>
    </div>
  );
};
