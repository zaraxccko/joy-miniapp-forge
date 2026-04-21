import { useState } from "react";
import { Trash2, Pencil, Plus, RotateCcw, Eye, ChevronLeft, MapPin } from "lucide-react";
import { useAuth } from "@/store/auth";
import { useCatalog } from "@/store/catalog";
import { useT } from "@/lib/i18n";
import { loc } from "@/lib/loc";
import { COUNTRIES } from "@/data/locations";
import type { Category, Product, LocalizedString } from "@/types/shop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

const GRADIENTS = ["gradient-mango", "gradient-mint", "gradient-grape", "gradient-primary", "gradient-hero"];

const blankProduct = (): Product => ({
  id: `p_${Date.now().toString(36)}`,
  name: { ru: "", en: "" },
  description: { ru: "", en: "" },
  category: "",
  priceTHB: 0,
  weight: "",
  inStock: 0,
  gradient: "gradient-mango",
  emoji: "✨",
  cities: [],
});

const blankCategory = (): Category => ({
  slug: `cat_${Date.now().toString(36)}`,
  name: { ru: "", en: "" },
  emoji: "✨",
  gradient: "gradient-mango",
});

/** Read RU or EN from a LocalizedString safely. */
const getLang = (v: LocalizedString | undefined, l: "ru" | "en"): string => {
  if (v == null) return "";
  if (typeof v === "string") return v;
  return v[l] ?? "";
};
const setLang = (
  v: LocalizedString | undefined,
  l: "ru" | "en",
  val: string
): LocalizedString => {
  const base = typeof v === "object" && v !== null ? v : { ru: typeof v === "string" ? v : "", en: "" };
  return { ...base, [l]: val };
};

const fileToDataUrl = (file: File) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });

interface AdminPageProps {
  onExit?: () => void;
}

const AdminPage = ({ onExit }: AdminPageProps) => {
  const t = useT();
  const {
    products,
    categories,
    upsertProduct,
    deleteProduct,
    upsertCategory,
    deleteCategory,
    reset,
  } = useCatalog();

  const [editingP, setEditingP] = useState<Product | null>(null);
  const [editingC, setEditingC] = useState<Category | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);

  const allCities = COUNTRIES.flatMap((c) => c.cities.map((city) => ({ ...city, country: c })));
  const activeCountry = COUNTRIES.find((c) => c.slug === selectedCountry);
  const activeCity = allCities.find((c) => c.slug === selectedCity);

  // Geo picker — country first
  if (!selectedCountry) {
    return (
      <div className="min-h-screen max-w-md mx-auto bg-background px-5 pt-6 pb-10">
        <header className="flex items-center justify-between mb-6">
          <button
            onClick={() => onExit?.()}
            className="flex items-center gap-1.5 text-xs text-muted-foreground active:scale-95"
          >
            <Eye className="w-4 h-4" /> {t("admin.viewShop")}
          </button>
          <h1 className="font-display font-bold text-base">{t("admin.title")}</h1>
          <span className="w-10" />
        </header>
        <h2 className="font-display font-extrabold text-2xl flex items-center gap-2">
          <MapPin className="w-5 h-5" /> Выберите страну
        </h2>
        <p className="text-muted-foreground text-sm mt-1 mb-6">
          Сначала выберите гео, затем настраивайте товары для него
        </p>
        <div className="grid grid-cols-2 gap-3">
          {COUNTRIES.map((c) => (
            <button
              key={c.slug}
              onClick={() => {
                if (c.cities.length === 1) {
                  setSelectedCountry(c.slug);
                  setSelectedCity(c.cities[0].slug);
                } else {
                  setSelectedCountry(c.slug);
                }
              }}
              className="bg-card rounded-3xl p-4 shadow-card active:scale-95 transition-[var(--transition-base)] text-left flex flex-col items-start gap-2"
            >
              <span className="text-4xl">{c.flag}</span>
              <span className="font-bold text-sm leading-tight">{c.name.ru}</span>
              <span className="text-[11px] text-muted-foreground">
                {products.filter((p) =>
                  c.cities.some((ct) => p.cities?.includes(ct.slug))
                ).length}{" "}
                товаров
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // City picker (when country has multiple cities)
  if (activeCountry && !selectedCity) {
    return (
      <div className="min-h-screen max-w-md mx-auto bg-background px-5 pt-6 pb-10">
        <header className="flex items-center gap-3 mb-6">
          <button
            onClick={() => setSelectedCountry(null)}
            className="w-10 h-10 rounded-2xl bg-card shadow-card flex items-center justify-center active:scale-95"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="font-display font-bold text-base flex-1 text-center">
            {activeCountry.flag} {activeCountry.shortName?.ru ?? activeCountry.name.ru}
          </h1>
          <span className="w-10" />
        </header>
        <h2 className="font-display font-extrabold text-2xl">Выберите город</h2>
        <div className="space-y-2 mt-6">
          {activeCountry.cities.map((city) => (
            <button
              key={city.slug}
              onClick={() => setSelectedCity(city.slug)}
              className="w-full bg-card rounded-2xl p-4 shadow-card active:scale-[0.98] flex items-center justify-between"
            >
              <span className="font-bold">{city.name.ru}</span>
              <span className="text-xs text-muted-foreground">
                {products.filter((p) => p.cities?.includes(city.slug)).length} товаров
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Filter to products available in the active city
  const visibleProducts = activeCity
    ? products.filter((p) => p.cities?.includes(activeCity.slug))
    : products;

  return (
    <div className="min-h-screen max-w-md mx-auto bg-background pb-10">
      <header className="sticky top-0 z-10 bg-background/90 backdrop-blur px-5 pt-5 pb-3 flex items-center justify-between gap-2">
        <button
          onClick={() => {
            // Back to city picker (if country has multiple cities) or country picker
            if (activeCountry && activeCountry.cities.length > 1) setSelectedCity(null);
            else {
              setSelectedCity(null);
              setSelectedCountry(null);
            }
          }}
          className="w-9 h-9 rounded-2xl bg-card shadow-card flex items-center justify-center active:scale-95 shrink-0"
          aria-label="Back"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 text-center min-w-0">
          <h1 className="font-display font-bold text-sm truncate">{t("admin.title")}</h1>
          <div className="text-[11px] text-muted-foreground truncate">
            {activeCountry?.flag} {activeCity?.name.ru}
          </div>
        </div>
        <button
          onClick={() => {
            if (confirm("Reset to samples?")) reset();
          }}
          className="w-9 h-9 rounded-2xl bg-card shadow-card flex items-center justify-center text-muted-foreground active:scale-95 shrink-0"
          aria-label="reset"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </header>

      <Tabs defaultValue="products" className="px-5">
        <TabsList className="w-full">
          <TabsTrigger value="products" className="flex-1">{t("admin.products")}</TabsTrigger>
          <TabsTrigger value="categories" className="flex-1">{t("admin.categories")}</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-3 mt-4">
          <Button
            onClick={() => {
              const p = blankProduct();
              if (activeCity) p.cities = [activeCity.slug];
              setEditingP(p);
            }}
            className="w-full gradient-primary"
          >
            <Plus className="w-4 h-4 mr-1" /> {t("admin.add")}
          </Button>

          {activeCity?.districts && activeCity.districts.length > 0 && (
            <div className="bg-card rounded-2xl p-3 shadow-card space-y-3">
              <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Районы города
              </div>
              {activeCity.districts.map((d) => {
                const items = visibleProducts.filter((p) =>
                  p.districts?.includes(d.slug)
                );
                return (
                  <div key={d.slug} className="border-t pt-2 first:border-t-0 first:pt-0">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-sm">{d.name.ru}</div>
                      <span className="text-[11px] text-muted-foreground">
                        {items.length} товаров
                      </span>
                    </div>
                    {items.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {items.map((p) => (
                          <span
                            key={p.id}
                            className="text-[11px] bg-muted rounded-full px-2 py-0.5"
                          >
                            {p.emoji} {loc(p.name, "ru")}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {visibleProducts.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-sm">
              {t("admin.noProducts")}
            </div>
          ) : (
            visibleProducts.map((p) => (
              <div key={p.id} className="bg-card rounded-2xl p-3 flex items-center gap-3 shadow-card">
                <div
                  className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 overflow-hidden ${!p.imageUrl ? p.gradient : ""}`}
                >
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl">{p.emoji}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate flex items-center gap-1">
                    {p.featured && <span title="Pick of the day">⭐</span>}
                    {loc(p.name, "ru") || "—"}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {loc(categories.find((c) => c.slug === p.category)?.name, "ru") || p.category}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {p.cities?.length ? p.cities.join(", ") : "all cities"}
                  </div>
                </div>
                <button
                  onClick={() => upsertProduct({ ...p, featured: !p.featured })}
                  className={`w-8 h-8 rounded-full flex items-center justify-center active:scale-90 text-base ${p.featured ? "gradient-primary text-primary-foreground shadow-glow" : "bg-background text-muted-foreground"}`}
                  aria-label="Pick of the day"
                  title="Подборка дня"
                >
                  ★
                </button>
                <button
                  onClick={() => setEditingP(p)}
                  className="w-8 h-8 rounded-full bg-background flex items-center justify-center active:scale-90"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete "${loc(p.name, "ru")}"?`)) deleteProduct(p.id);
                  }}
                  className="w-8 h-8 rounded-full bg-background flex items-center justify-center active:scale-90"
                >
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </button>
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="categories" className="space-y-3 mt-4">
          <Button onClick={() => setEditingC(blankCategory())} className="w-full gradient-primary">
            <Plus className="w-4 h-4 mr-1" /> {t("admin.add")}
          </Button>

          {categories.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-sm">
              {t("admin.noCategories")}
            </div>
          ) : (
            categories.map((c) => (
              <div key={c.slug} className="bg-card rounded-2xl p-3 flex items-center gap-3 shadow-card">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${c.gradient}`}>
                  <span className="text-xl">{c.emoji}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{loc(c.name, "ru")}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{c.slug}</div>
                </div>
                <button
                  onClick={() => setEditingC(c)}
                  className="w-8 h-8 rounded-full bg-background flex items-center justify-center active:scale-90"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete "${loc(c.name, "ru")}"?`)) deleteCategory(c.slug);
                  }}
                  className="w-8 h-8 rounded-full bg-background flex items-center justify-center active:scale-90"
                >
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </button>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Product editor */}
      <Dialog open={!!editingP} onOpenChange={(o) => !o && setEditingP(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{loc(editingP?.name, "ru") ? t("admin.edit") : t("admin.add")}</DialogTitle>
          </DialogHeader>
          {editingP && (
            <div className="space-y-3">
              <div>
                <Label>{t("admin.image")}</Label>
                <div className="flex items-center gap-3 mt-1">
                  <div
                    className={`w-16 h-16 rounded-xl flex items-center justify-center overflow-hidden ${!editingP.imageUrl ? editingP.gradient : ""}`}
                  >
                    {editingP.imageUrl ? (
                      <img src={editingP.imageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl">{editingP.emoji}</span>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const url = await fileToDataUrl(file);
                      setEditingP({ ...editingP, imageUrl: url });
                    }}
                    className="text-xs"
                  />
                  {editingP.imageUrl && (
                    <button
                      onClick={() => setEditingP({ ...editingP, imageUrl: undefined })}
                      className="text-xs text-destructive"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">{t("admin.imageHint")}</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>{t("admin.emoji")}</Label>
                  <Input
                    value={editingP.emoji}
                    onChange={(e) => setEditingP({ ...editingP, emoji: e.target.value })}
                  />
                </div>
                <div>
                  <Label>{t("admin.gradient")}</Label>
                  <Select
                    value={editingP.gradient}
                    onValueChange={(v) => setEditingP({ ...editingP, gradient: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {GRADIENTS.map((g) => (
                        <SelectItem key={g} value={g}>{g}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>{t("admin.name")} (RU)</Label>
                <Input
                  value={getLang(editingP.name, "ru")}
                  onChange={(e) =>
                    setEditingP({ ...editingP, name: setLang(editingP.name, "ru", e.target.value) })
                  }
                />
              </div>
              <div>
                <Label>{t("admin.name")} (EN)</Label>
                <Input
                  value={getLang(editingP.name, "en")}
                  onChange={(e) =>
                    setEditingP({ ...editingP, name: setLang(editingP.name, "en", e.target.value) })
                  }
                />
              </div>
              <div>
                <Label>{t("admin.description")} (RU)</Label>
                <Textarea
                  value={getLang(editingP.description, "ru")}
                  onChange={(e) =>
                    setEditingP({ ...editingP, description: setLang(editingP.description, "ru", e.target.value) })
                  }
                />
              </div>
              <div>
                <Label>{t("admin.description")} (EN)</Label>
                <Textarea
                  value={getLang(editingP.description, "en")}
                  onChange={(e) =>
                    setEditingP({ ...editingP, description: setLang(editingP.description, "en", e.target.value) })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2 grid grid-cols-2 gap-2">
                  <div>
                    <Label>{t("admin.badge")} (RU)</Label>
                    <Input
                      value={getLang(editingP.badge, "ru")}
                      onChange={(e) => {
                        const v = setLang(editingP.badge, "ru", e.target.value);
                        const empty = !getLang(v, "ru") && !getLang(v, "en");
                        setEditingP({ ...editingP, badge: empty ? undefined : v });
                      }}
                    />
                  </div>
                  <div>
                    <Label>{t("admin.badge")} (EN)</Label>
                    <Input
                      value={getLang(editingP.badge, "en")}
                      onChange={(e) => {
                        const v = setLang(editingP.badge, "en", e.target.value);
                        const empty = !getLang(v, "ru") && !getLang(v, "en");
                        setEditingP({ ...editingP, badge: empty ? undefined : v });
                      }}
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label>{t("admin.category")}</Label>
                <Select
                  value={editingP.category}
                  onValueChange={(v) => setEditingP({ ...editingP, category: v })}
                >
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.slug} value={c.slug}>
                        {c.emoji} {loc(c.name, "ru")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between bg-muted rounded-xl p-3">
                <Label className="m-0">{t("admin.featured")}</Label>
                <Switch
                  checked={!!editingP.featured}
                  onCheckedChange={(v) => setEditingP({ ...editingP, featured: v })}
                />
              </div>

              <div>
                <Label>{t("admin.cities")}</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {allCities.map((c) => {
                    const checked = editingP.cities?.includes(c.slug) ?? false;
                    return (
                      <label
                        key={c.slug}
                        className="flex items-center gap-2 bg-muted rounded-lg p-2 text-xs"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            const set = new Set(editingP.cities ?? []);
                            if (v) set.add(c.slug);
                            else set.delete(c.slug);
                            setEditingP({ ...editingP, cities: Array.from(set) });
                          }}
                        />
                        {c.country.flag} {c.name.ru}
                      </label>
                    );
                  })}
                </div>
              </div>

              {(() => {
                const selectedCities = allCities.filter((c) =>
                  editingP.cities?.includes(c.slug)
                );
                const cityWithDistricts = selectedCities.filter(
                  (c) => c.districts && c.districts.length > 0
                );
                if (cityWithDistricts.length === 0) return null;
                return (
                  <div>
                    <Label>Районы</Label>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Отметьте районы, где доступен товар. Если не выбрать ни одного — товар не будет показан ни в одном районе.
                    </p>
                    <div className="space-y-3 mt-2">
                      {cityWithDistricts.map((city) => (
                        <div key={city.slug}>
                          <div className="text-xs font-semibold mb-1">
                            {city.country.flag} {city.name.ru}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {city.districts!.map((d) => {
                              const checked =
                                editingP.districts?.includes(d.slug) ?? false;
                              return (
                                <label
                                  key={d.slug}
                                  className="flex items-center gap-2 bg-muted rounded-lg p-2 text-xs"
                                >
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={(v) => {
                                      const set = new Set(editingP.districts ?? []);
                                      if (v) set.add(d.slug);
                                      else set.delete(d.slug);
                                      setEditingP({
                                        ...editingP,
                                        districts: Array.from(set),
                                      });
                                    }}
                                  />
                                  {d.name.ru}
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Variants editor (grams + price by country + districts) */}
              {(() => {
                const variants = editingP.variants ?? [];
                const updateVariants = (v: typeof variants) =>
                  setEditingP({ ...editingP, variants: v });

                const selectedCountries = COUNTRIES.filter((co) =>
                  co.cities.some((ci) => editingP.cities?.includes(ci.slug))
                );
                const selectedCitiesWithDistricts = allCities.filter(
                  (c) =>
                    editingP.cities?.includes(c.slug) &&
                    c.districts &&
                    c.districts.length > 0
                );

                const PRESETS = [1, 2, 5, 10];
                const usedGrams = new Set(variants.map((v) => v.grams));

                return (
                  <div className="border-t pt-4">
                    <Label>Варианты (фасовки)</Label>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Граммовки с ценой по странам и доступностью по районам.
                    </p>

                    <div className="flex flex-wrap gap-1 mt-2">
                      {PRESETS.filter((g) => !usedGrams.has(g)).map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() =>
                            updateVariants([
                              ...variants,
                              { id: `${g}g`, grams: g, pricesByCountry: {} },
                            ])
                          }
                          className="text-xs bg-muted rounded-full px-2 py-1 active:scale-95"
                        >
                          + {g}г
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          const raw = prompt("Сколько грамм?");
                          const g = Number(raw);
                          if (!g || g <= 0 || usedGrams.has(g)) return;
                          updateVariants([
                            ...variants,
                            { id: `${g}g`, grams: g, pricesByCountry: {} },
                          ]);
                        }}
                        className="text-xs bg-muted rounded-full px-2 py-1 active:scale-95"
                      >
                        + другое
                      </button>
                    </div>

                    <div className="space-y-3 mt-3">
                      {variants.length === 0 && (
                        <div className="text-xs text-muted-foreground">
                          Пока нет вариантов.
                        </div>
                      )}
                      {variants
                        .slice()
                        .sort((a, b) => a.grams - b.grams)
                        .map((variant) => (
                          <div
                            key={variant.id}
                            className="bg-muted/50 rounded-xl p-3 space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <div className="font-bold text-sm">{variant.grams}г</div>
                              <button
                                type="button"
                                onClick={() =>
                                  updateVariants(variants.filter((v) => v.id !== variant.id))
                                }
                                className="w-7 h-7 rounded-full bg-background flex items-center justify-center active:scale-90"
                                aria-label="Удалить вариант"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-destructive" />
                              </button>
                            </div>

                            {selectedCountries.length === 0 ? (
                              <div className="text-[11px] text-muted-foreground">
                                Сначала выберите города выше.
                              </div>
                            ) : (
                              <div>
                                <div className="text-[11px] text-muted-foreground mb-1">
                                  Цена по странам ($)
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  {selectedCountries.map((co) => (
                                    <label key={co.slug} className="flex items-center gap-2 text-xs">
                                      <span className="w-14 shrink-0">
                                        {co.flag} {co.shortName?.ru ?? co.name.ru}
                                      </span>
                                      <Input
                                        type="number"
                                        className="h-8"
                                        value={variant.pricesByCountry[co.slug] ?? ""}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          const next = { ...variant.pricesByCountry };
                                          if (val === "") delete next[co.slug];
                                          else next[co.slug] = Number(val) || 0;
                                          updateVariants(
                                            variants.map((v) =>
                                              v.id === variant.id
                                                ? { ...v, pricesByCountry: next }
                                                : v
                                            )
                                          );
                                        }}
                                      />
                                    </label>
                                  ))}
                                </div>
                              </div>
                            )}

                            {selectedCitiesWithDistricts.length > 0 && (
                              <div>
                                <div className="text-[11px] text-muted-foreground mb-1">
                                  Доступен в районах (пусто = нигде)
                                </div>
                                <div className="space-y-1.5">
                                  {selectedCitiesWithDistricts.map((city) => (
                                    <div key={city.slug}>
                                      <div className="text-[11px] font-semibold">
                                        {city.country.flag} {city.name.ru}
                                      </div>
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {city.districts!.map((d) => {
                                          const checked = variant.districts?.includes(d.slug) ?? false;
                                          return (
                                            <button
                                              key={d.slug}
                                              type="button"
                                              onClick={() => {
                                                const set = new Set(variant.districts ?? []);
                                                if (checked) set.delete(d.slug);
                                                else set.add(d.slug);
                                                updateVariants(
                                                  variants.map((v) =>
                                                    v.id === variant.id
                                                      ? { ...v, districts: Array.from(set) }
                                                      : v
                                                  )
                                                );
                                              }}
                                              className={`text-[11px] rounded-full px-2 py-0.5 ${checked ? "gradient-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}
                                            >
                                              {d.name.ru}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
          <DialogFooter className="flex-row gap-2">
            <Button variant="outline" onClick={() => setEditingP(null)} className="flex-1">
              {t("admin.cancel")}
            </Button>
            <Button
              onClick={() => {
                if (editingP) {
                  upsertProduct(editingP);
                  setEditingP(null);
                }
              }}
              className="flex-1 gradient-primary"
            >
              {t("admin.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category editor */}
      <Dialog open={!!editingC} onOpenChange={(o) => !o && setEditingC(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{loc(editingC?.name, "ru") ? t("admin.edit") : t("admin.add")}</DialogTitle>
          </DialogHeader>
          {editingC && (
            <div className="space-y-3">
              <div>
                <Label>{t("admin.name")} (RU)</Label>
                <Input
                  value={getLang(editingC.name, "ru")}
                  onChange={(e) =>
                    setEditingC({ ...editingC, name: setLang(editingC.name, "ru", e.target.value) })
                  }
                />
              </div>
              <div>
                <Label>{t("admin.name")} (EN)</Label>
                <Input
                  value={getLang(editingC.name, "en")}
                  onChange={(e) =>
                    setEditingC({ ...editingC, name: setLang(editingC.name, "en", e.target.value) })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>{t("admin.emoji")}</Label>
                  <Input
                    value={editingC.emoji}
                    onChange={(e) => setEditingC({ ...editingC, emoji: e.target.value })}
                  />
                </div>
                <div>
                  <Label>{t("admin.gradient")}</Label>
                  <Select
                    value={editingC.gradient}
                    onValueChange={(v) => setEditingC({ ...editingC, gradient: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {GRADIENTS.map((g) => (
                        <SelectItem key={g} value={g}>{g}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="flex-row gap-2">
            <Button variant="outline" onClick={() => setEditingC(null)} className="flex-1">
              {t("admin.cancel")}
            </Button>
            <Button
              onClick={() => {
                if (editingC) {
                  const slugify = (s: string) =>
                    s
                      .toLowerCase()
                      .trim()
                      .replace(/[^a-z0-9]+/g, "-")
                      .replace(/^-+|-+$/g, "");
                  const enName = getLang(editingC.name, "en");
                  const ruName = getLang(editingC.name, "ru");
                  const autoSlug =
                    slugify(enName) || slugify(ruName) || `cat-${Date.now().toString(36)}`;
                  const slug = editingC.slug?.startsWith("cat_") || !editingC.slug
                    ? autoSlug
                    : editingC.slug;
                  upsertCategory({ ...editingC, slug });
                  setEditingC(null);
                }
              }}
              className="flex-1 gradient-primary"
            >
              {t("admin.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPage;
