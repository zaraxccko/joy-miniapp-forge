import { useMemo, useState } from "react";
import { ChevronLeft, MapPin, Plus, X } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import type { Product } from "@/types/shop";
import { useCart } from "@/store/cart";
import { useLocation } from "@/store/location";
import { useI18n } from "@/lib/i18n";
import { loc } from "@/lib/loc";
import { haptic } from "@/lib/telegram";
import { COUNTRIES, findCity } from "@/data/locations";
import { cn } from "@/lib/utils";

interface ProductSheetProps {
  product: Product | null;
  onOpenChange: (open: boolean) => void;
}

export const ProductSheet = ({ product, onOpenChange }: ProductSheetProps) => {
  const lang = useI18n((s) => s.lang) ?? "ru";
  const citySlug = useLocation((s) => s.city);
  const add = useCart((s) => s.add);
  const [districtSlug, setDistrictSlug] = useState<string | null>(null);

  // Reset selected district whenever the sheet (re)opens with a product
  const productId = product?.id;
  useMemo(() => {
    setDistrictSlug(null);
  }, [productId]);

  const cityInfo = citySlug ? findCity(citySlug) : null;
  const country = cityInfo?.country;
  const city = cityInfo?.city;

  // Variants of this product available in the current city
  const variantsInCity = useMemo(() => {
    if (!product || !country) return [];
    return (product.variants ?? []).filter((v) => {
      // Has price for this country
      if (!v.pricesByCountry?.[country.slug]) return false;
      // If the city has districts, variant must list at least one district of this city
      if (city?.districts && city.districts.length > 0) {
        const cityDistrictSlugs = new Set(city.districts.map((d) => d.slug));
        return (v.districts ?? []).some((d) => cityDistrictSlugs.has(d));
      }
      return true;
    });
  }, [product, country, city]);

  // Districts in this city that have at least one variant available
  const availableDistricts = useMemo(() => {
    if (!city?.districts || !product) return [];
    return city.districts.filter((d) =>
      variantsInCity.some((v) => v.districts?.includes(d.slug))
    );
  }, [city, variantsInCity, product]);

  // Variants available in the chosen district
  const variantsInDistrict = useMemo(() => {
    if (!districtSlug) return [];
    return variantsInCity.filter((v) => v.districts?.includes(districtSlug));
  }, [districtSlug, variantsInCity]);

  if (!product) return null;
  const name = loc(product.name, lang);
  const description = loc(product.description, lang);

  // City has no districts → skip district step, show variants directly
  const skipDistrictStep = !city?.districts || city.districts.length === 0;
  const effectiveVariants = skipDistrictStep ? variantsInCity : variantsInDistrict;
  const showDistrictPicker = !skipDistrictStep && !districtSlug;

  return (
    <Sheet open={!!product} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl border-0 p-0 max-h-[90vh] flex flex-col bg-background [&>button.absolute]:hidden"
      >
        {/* Top image */}
        <div
          className={cn(
            "aspect-[16/9] relative flex items-center justify-center overflow-hidden rounded-t-3xl",
            !product.imageUrl && product.gradient
          )}
        >
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-[96px] drop-shadow-sm select-none">{product.emoji}</span>
          )}
          <button
            onClick={() => onOpenChange(false)}
            className="absolute top-3 right-3 z-20 w-9 h-9 rounded-full bg-card/90 backdrop-blur flex items-center justify-center active:scale-90 shadow-card"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
          {!skipDistrictStep && districtSlug && (
            <button
              onClick={() => {
                haptic("light");
                setDistrictSlug(null);
              }}
              className="absolute top-3 left-3 h-9 px-3 rounded-full bg-card/90 backdrop-blur flex items-center gap-1 text-xs font-semibold active:scale-95"
            >
              <ChevronLeft className="w-4 h-4" />
              {lang === "ru" ? "Район" : "District"}
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 pt-4 pb-6">
          <h2 className="font-display font-bold text-2xl leading-tight">{name}</h2>
          {description && (
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{description}</p>
          )}

          {/* Step 1: pick district */}
          {showDistrictPicker && (
            <div className="mt-5">
              <div className="flex items-center gap-1.5 text-sm font-semibold mb-3">
                <MapPin className="w-4 h-4 text-primary" />
                {lang === "ru" ? "Выберите район" : "Choose a district"}
              </div>
              {availableDistricts.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  {lang === "ru"
                    ? "Нет в наличии в вашем городе."
                    : "Not available in your city."}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {availableDistricts.map((d) => (
                    <button
                      key={d.slug}
                      onClick={() => {
                        haptic("light");
                        setDistrictSlug(d.slug);
                      }}
                      className="bg-card rounded-2xl p-3 text-left shadow-card active:scale-[0.98]"
                    >
                      <div className="font-semibold text-sm">{d.name[lang]}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {(() => {
                          const n = variantsInCity.filter((v) => v.districts?.includes(d.slug)).length;
                          if (lang === "ru") {
                            const mod10 = n % 10;
                            const mod100 = n % 100;
                            let word = "вариантов";
                            if (mod10 === 1 && mod100 !== 11) word = "вариант";
                            else if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) word = "варианта";
                            return `${n} ${word}`;
                          }
                          return `${n} ${n === 1 ? "option" : "options"}`;
                        })()}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2: variants */}
          {!showDistrictPicker && (
            <div className="mt-5 space-y-2">
              {!skipDistrictStep && (
                <div className="text-xs text-muted-foreground mb-1">
                  {lang === "ru" ? "Доступно в районе" : "Available in"}{" "}
                  <span className="font-semibold text-foreground">
                    {city?.districts?.find((d) => d.slug === districtSlug)?.name[lang]}
                  </span>
                </div>
              )}
              {effectiveVariants.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  {lang === "ru" ? "Нет доступных фасовок." : "No options available."}
                </div>
              ) : (
                effectiveVariants
                  .slice()
                  .sort((a, b) => a.grams - b.grams)
                  .map((v) => {
                    const price = country ? v.pricesByCountry?.[country.slug] ?? 0 : 0;
                    return (
                      <div
                        key={v.id}
                        className="bg-card rounded-2xl p-3 shadow-card flex items-center gap-3"
                      >
                        <div className="flex-1">
                          <div className="font-bold text-base">{v.grams}г</div>
                          <div className="text-xs text-muted-foreground">${price}</div>
                        </div>
                        <button
                          onClick={() => {
                            haptic("medium");
                            add(product, {
                              variantId: v.id,
                              districtSlug: districtSlug ?? undefined,
                              priceUSD: price,
                            });
                          }}
                          className="h-9 px-4 rounded-full gradient-primary text-primary-foreground font-bold text-sm flex items-center gap-1 shadow-glow active:scale-95"
                        >
                          <Plus className="w-4 h-4" strokeWidth={3} />
                          {lang === "ru" ? "В корзину" : "Add"}
                        </button>
                      </div>
                    );
                  })
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
