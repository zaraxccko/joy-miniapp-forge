import { useEffect, useState } from "react";
import { Plus, Trash2, Power, PowerOff } from "lucide-react";
import { Admin, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface PromoCode {
  id: string;
  code: string;
  discountPct: number;
  active: boolean;
  createdAt: string;
  redemptions: number;
}

/**
 * Админка промокодов: создание, список, активация, удаление.
 * Промокод применяется юзером 1 раз — лимит обеспечивает уникальный индекс
 * (promo_id, user_tg_id) в таблице promo_redemptions.
 */
export const PromoTab = () => {
  const [list, setList] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState("");
  const [pct, setPct] = useState<number>(10);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await Admin.promoList();
      setList(data);
    } catch (e) {
      console.error(e);
      toast.error("Не удалось загрузить промокоды");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async () => {
    const trimmed = code.trim();
    if (!trimmed) return toast.error("Введите код");
    if (!/^[A-Za-z0-9_-]+$/.test(trimmed)) {
      return toast.error("Код может содержать только латиницу, цифры, _ и -");
    }
    if (!pct || pct < 1 || pct > 100) return toast.error("Скидка от 1 до 100%");
    setCreating(true);
    try {
      await Admin.promoCreate({ code: trimmed, discountPct: pct });
      toast.success(`Промокод ${trimmed.toUpperCase()} создан`);
      setCode("");
      setPct(10);
      await load();
    } catch (e) {
      const err = e as ApiError;
      if (err?.status === 409) toast.error("Такой код уже существует");
      else toast.error("Не удалось создать промокод");
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (p: PromoCode) => {
    try {
      await Admin.promoUpdate(p.id, { active: !p.active });
      await load();
    } catch {
      toast.error("Не удалось обновить");
    }
  };

  const remove = async (p: PromoCode) => {
    if (!confirm(`Удалить промокод ${p.code}?`)) return;
    try {
      await Admin.promoDelete(p.id);
      toast.success("Удалено");
      await load();
    } catch {
      toast.error("Не удалось удалить");
    }
  };

  return (
    <div className="space-y-4">
      {/* Create form */}
      <div className="bg-card rounded-2xl p-4 shadow-card space-y-3">
        <div className="font-bold text-sm">Новый промокод</div>
        <div className="grid grid-cols-[1fr_100px] gap-2">
          <div>
            <Label className="text-xs">Код</Label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="SUMMER10"
              className="uppercase"
              maxLength={64}
            />
          </div>
          <div>
            <Label className="text-xs">Скидка %</Label>
            <Input
              type="number"
              min={1}
              max={100}
              value={pct}
              onChange={(e) => setPct(Number(e.target.value))}
            />
          </div>
        </div>
        <Button
          onClick={handleCreate}
          disabled={creating}
          className="w-full gradient-primary"
        >
          <Plus className="w-4 h-4 mr-1" />
          {creating ? "Создаём…" : "Создать"}
        </Button>
        <p className="text-[11px] text-muted-foreground">
          Каждый юзер сможет применить код только 1 раз.
        </p>
      </div>

      {/* List */}
      {loading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Загружаем…</div>
      ) : list.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          Пока нет промокодов
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((p) => (
            <div
              key={p.id}
              className={`bg-card rounded-2xl p-3 shadow-card flex items-center gap-3 ${
                !p.active ? "opacity-60" : ""
              }`}
            >
              <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center text-xl shrink-0">
                🎟️
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm font-mono truncate">{p.code}</div>
                <div className="text-[11px] text-muted-foreground">
                  −{p.discountPct}% · использован {p.redemptions} раз
                  {!p.active && " · отключён"}
                </div>
              </div>
              <button
                onClick={() => toggleActive(p)}
                className="w-8 h-8 rounded-full bg-background flex items-center justify-center active:scale-90"
                title={p.active ? "Отключить" : "Включить"}
              >
                {p.active ? (
                  <Power className="w-3.5 h-3.5 text-primary" />
                ) : (
                  <PowerOff className="w-3.5 h-3.5 text-muted-foreground" />
                )}
              </button>
              <button
                onClick={() => remove(p)}
                className="w-8 h-8 rounded-full bg-background flex items-center justify-center active:scale-90"
                title="Удалить"
              >
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
