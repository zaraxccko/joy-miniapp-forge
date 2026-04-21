import { TabsContent } from "@/components/ui/tabs";
import { TrendingUp, Users, ShoppingBag, DollarSign, Activity, Send } from "lucide-react";
import { MOCK_ANALYTICS } from "@/lib/analyticsMock";

const KPI = ({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  hint?: string;
}) => (
  <div className="bg-card rounded-2xl shadow-card p-3">
    <div className="flex items-center gap-2 text-muted-foreground text-[11px] uppercase tracking-wide font-semibold">
      <Icon className="w-3.5 h-3.5" /> {label}
    </div>
    <div className="font-display font-extrabold text-xl mt-1">{value}</div>
    {hint && <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>}
  </div>
);

const Sparkline = ({
  data,
  color = "hsl(var(--primary))",
}: {
  data: { date: string; value: number }[];
  color?: string;
}) => {
  const w = 280;
  const h = 60;
  const max = Math.max(...data.map((d) => d.value), 1);
  const step = w / Math.max(data.length - 1, 1);
  const points = data
    .map((d, i) => `${i * step},${h - (d.value / max) * (h - 6) - 3}`)
    .join(" ");
  const area = `0,${h} ${points} ${w},${h}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-16">
      <polygon points={area} fill={color} opacity={0.12} />
      <polyline points={points} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

const FunnelRow = ({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) => {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="font-semibold">{label}</span>
        <span className="text-muted-foreground">
          {value.toLocaleString("ru")} <span className="opacity-60">· {pct}%</span>
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className="h-full gradient-primary rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

export const AnalyticsTab = () => {
  const a = MOCK_ANALYTICS;
  return (
    <TabsContent value="analytics" className="space-y-4 mt-4">
      <div className="rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3 text-[11px] text-muted-foreground">
        📊 Демо-данные. Реальные цифры появятся после подключения бота на VPS.
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-2">
        <KPI icon={Users} label="Юзеров" value={a.totals.users.toLocaleString("ru")} hint="всего" />
        <KPI icon={Activity} label="Активаций" value={a.totals.activations.toLocaleString("ru")} hint="/start всего" />
        <KPI icon={Users} label="DAU" value={a.totals.dau.toString()} hint="за сегодня" />
        <KPI icon={Users} label="MAU" value={a.totals.mau.toLocaleString("ru")} hint="за месяц" />
        <KPI icon={DollarSign} label="GMV" value={`$${a.totals.gmvUSD.toLocaleString("ru")}`} hint="за всё время" />
        <KPI icon={ShoppingBag} label="Заказов" value={a.totals.ordersToday.toString()} hint="сегодня" />
      </div>

      {/* Sparklines */}
      <div className="bg-card rounded-2xl shadow-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="font-bold text-sm flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-primary" /> Активации (7д)
          </div>
          <span className="text-xs text-muted-foreground">
            +{a.activations7d[a.activations7d.length - 1].value}
          </span>
        </div>
        <Sparkline data={a.activations7d} />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          {a.activations7d.map((d) => (
            <span key={d.date}>{d.date}</span>
          ))}
        </div>
      </div>

      <div className="bg-card rounded-2xl shadow-card p-4 space-y-3">
        <div className="font-bold text-sm flex items-center gap-1.5">
          <Users className="w-4 h-4 text-primary" /> DAU (7д)
        </div>
        <Sparkline data={a.dau7d} />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          {a.dau7d.map((d) => (
            <span key={d.date}>{d.date}</span>
          ))}
        </div>
      </div>

      {/* Funnel */}
      <div className="bg-card rounded-2xl shadow-card p-4 space-y-3">
        <div className="font-bold text-sm">Воронка онбординга</div>
        <FunnelRow label="/start" value={a.funnel.starts} total={a.funnel.starts} />
        <FunnelRow label="Прошли капчу" value={a.funnel.captchaPassed} total={a.funnel.starts} />
        <FunnelRow label="Открыли Mini App" value={a.funnel.miniAppOpened} total={a.funnel.starts} />
        <FunnelRow label="Сделали 1-й заказ" value={a.funnel.firstOrder} total={a.funnel.starts} />
      </div>

      {/* Deposits funnel */}
      <div className="bg-card rounded-2xl shadow-card p-4 space-y-3">
        <div className="font-bold text-sm">Воронка пополнений</div>
        <FunnelRow label="Создано" value={a.depositsFunnel.created} total={a.depositsFunnel.created} />
        <FunnelRow label="Оплачено" value={a.depositsFunnel.paid} total={a.depositsFunnel.created} />
        <FunnelRow label="Подтверждено" value={a.depositsFunnel.confirmed} total={a.depositsFunnel.created} />
      </div>

      {/* Top products */}
      <div className="bg-card rounded-2xl shadow-card p-4">
        <div className="font-bold text-sm mb-3">Топ товаров</div>
        <div className="space-y-2">
          {a.topProducts.map((p, i) => (
            <div key={p.name} className="flex items-center gap-2 text-sm">
              <span className="w-5 text-muted-foreground text-xs">{i + 1}.</span>
              <span className="flex-1 truncate">{p.name}</span>
              <span className="text-xs text-muted-foreground">{p.orders} зак.</span>
              <span className="font-bold text-xs w-16 text-right">${p.gmvUSD.toLocaleString("ru")}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Sources */}
      <div className="bg-card rounded-2xl shadow-card p-4">
        <div className="font-bold text-sm mb-3 flex items-center gap-1.5">
          <Send className="w-4 h-4 text-primary" /> Источники трафика
        </div>
        <div className="space-y-2">
          {a.sources.map((s) => {
            const total = a.sources.reduce((acc, x) => acc + x.users, 0);
            const pct = Math.round((s.users / total) * 100);
            return (
              <div key={s.source}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-semibold">{s.source}</span>
                  <span className="text-muted-foreground">
                    {s.users} <span className="opacity-60">· {pct}%</span>
                  </span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full gradient-primary rounded-full" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </TabsContent>
  );
};
