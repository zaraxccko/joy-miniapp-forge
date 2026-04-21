import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { COUNTRIES, type Country } from "@/data/locations";
import { useLocation } from "@/store/location";
import { useI18n, useT } from "@/lib/i18n";
import { haptic } from "@/lib/telegram";
import logo from "@/assets/logo.png";

interface LocationPickerProps {
  onPicked: () => void;
  showBack?: boolean;
  onBack?: () => void;
}

export const LocationPicker = ({ onPicked, showBack, onBack }: LocationPickerProps) => {
  const t = useT();
  const lang = useI18n((s) => s.lang) ?? "ru";
  const setLang = useI18n((s) => s.setLang);
  const setCity = useLocation((s) => s.setCity);
  const [country, setCountry] = useState<Country | null>(null);

  const choose = (citySlug: string) => {
    haptic("success");
    setCity(citySlug);
    onPicked();
  };

  return (
    <div className="min-h-screen max-w-md mx-auto bg-background flex flex-col px-5 pt-6 pb-10">
      <div className="flex items-center gap-3 mb-6">
        {(country || showBack) && (
          <button
            onClick={() => {
              haptic("light");
              if (country) setCountry(null);
              else onBack?.();
            }}
            className="w-10 h-10 rounded-2xl bg-card shadow-card flex items-center justify-center active:scale-95"
            aria-label="Back"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        <img src={logo} alt="Love Shop" className="w-10 h-10 rounded-xl object-cover" />
        <div className="font-display font-bold text-lg">Love Shop</div>
      </div>

      <h2 className="font-display font-extrabold text-2xl">
        {country ? t("loc.pickCity") : t("loc.title")}
      </h2>
      <p className="text-muted-foreground text-sm mt-1 mb-6">{t("loc.subtitle")}</p>

      {!country ? (
        <div className="grid grid-cols-2 gap-3">
          {COUNTRIES.map((c) => (
            <button
              key={c.slug}
              onClick={() => {
                haptic("light");
                if (c.cities.length === 1) choose(c.cities[0].slug);
                else setCountry(c);
              }}
              className="bg-card rounded-3xl p-4 shadow-card active:scale-95 transition-[var(--transition-base)] text-left flex flex-col items-start gap-2"
            >
              <span className="text-4xl">{c.flag}</span>
              <span className="font-bold text-sm leading-tight">{c.name[lang]}</span>
              <span className="text-[11px] text-muted-foreground">
                {c.cities.length === 1
                  ? c.cities[0].name[lang]
                  : `${c.cities.length} ${lang === "ru" ? "городов" : "cities"}`}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {country.cities.map((city) => (
            <button
              key={city.slug}
              onClick={() => choose(city.slug)}
              className="w-full bg-card rounded-2xl p-4 shadow-card active:scale-[0.98] transition-[var(--transition-base)] flex items-center gap-3"
            >
              <span className="text-2xl">{country.flag}</span>
              <span className="font-bold">{city.name[lang]}</span>
            </button>
          ))}
        </div>
      )}

      {!country && (
        <button
          onClick={() => {
            haptic("light");
            setLang(null);
          }}
          className="mt-8 mx-auto text-xs text-muted-foreground underline-offset-4 hover:underline active:scale-95"
        >
          {lang === "ru" ? "← Сменить язык" : "← Change language"}
        </button>
      )}
    </div>
  );
};
