import { useState } from "react";
import { Link } from "react-router-dom";
import { Trash2, Pencil, Plus, RotateCcw, ArrowLeft } from "lucide-react";
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

const AdminPage = () => {
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

  const allCities = COUNTRIES.flatMap((c) => c.cities.map((city) => ({ ...city, country: c })));

  return (
    <div className="min-h-screen max-w-md mx-auto bg-background pb-10">
      <header className="sticky top-0 z-10 bg-background/90 backdrop-blur px-5 pt-5 pb-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground active:scale-95">
          <ArrowLeft className="w-4 h-4" /> {t("admin.back")}
        </Link>
        <h1 className="font-display font-bold text-base">{t("admin.title")}</h1>
        <button
          onClick={() => {
            if (confirm("Reset to samples?")) reset();
          }}
          className="text-muted-foreground active:scale-95"
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
          <Button onClick={() => setEditingP(blankProduct())} className="w-full gradient-primary">
            <Plus className="w-4 h-4 mr-1" /> {t("admin.add")}
          </Button>

          {products.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-sm">
              {t("admin.noProducts")}
            </div>
          ) : (
            products.map((p) => (
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
                  <div className="font-semibold text-sm truncate">{loc(p.name, "ru") || "—"}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    ${p.priceTHB} · {loc(categories.find((c) => c.slug === p.category)?.name, "ru") || p.category}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {p.cities?.length ? p.cities.join(", ") : "all cities"}
                  </div>
                </div>
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
                <div>
                  <Label>{t("admin.price")}</Label>
                  <Input
                    type="number"
                    value={editingP.priceTHB}
                    onChange={(e) =>
                      setEditingP({ ...editingP, priceTHB: Number(e.target.value) || 0 })
                    }
                  />
                </div>
                <div>
                  <Label>{t("admin.stock")}</Label>
                  <Input
                    type="number"
                    value={editingP.inStock}
                    onChange={(e) =>
                      setEditingP({ ...editingP, inStock: Number(e.target.value) || 0 })
                    }
                  />
                </div>
                <div>
                  <Label>{t("admin.thc")}</Label>
                  <Input
                    type="number"
                    value={editingP.thcMg ?? ""}
                    onChange={(e) =>
                      setEditingP({
                        ...editingP,
                        thcMg: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                  />
                </div>
                <div>
                  <Label>{t("admin.cbd")}</Label>
                  <Input
                    type="number"
                    value={editingP.cbdMg ?? ""}
                    onChange={(e) =>
                      setEditingP({
                        ...editingP,
                        cbdMg: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                  />
                </div>
                <div>
                  <Label>{t("admin.weight")}</Label>
                  <Input
                    value={editingP.weight ?? ""}
                    onChange={(e) => setEditingP({ ...editingP, weight: e.target.value })}
                  />
                </div>
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
                <Label>{t("admin.slug")}</Label>
                <Input
                  value={editingC.slug}
                  onChange={(e) => setEditingC({ ...editingC, slug: e.target.value })}
                />
              </div>
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
                  upsertCategory(editingC);
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
