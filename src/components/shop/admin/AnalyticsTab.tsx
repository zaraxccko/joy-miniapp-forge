import { useState } from "react";
import { TabsContent } from "@/components/ui/tabs";
import { TrendingUp, Users, ShoppingBag, DollarSign, Activity } from "lucide-react";
import { useAdminPanel } from "@/store/adminPanel";

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
  unit = "",
}: {
  data: { date: string; value: number }[];
  color?: string;
  unit?: string;
}) => {
  const w = 280;
  const h = 60;
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.value), 1);
  const step = w / Math.max(data.length - 1, 1);
  const coords = data.map((d, i) => ({
    x: i * step,
    y: h - (d.value / max) * (h - 6) - 3,
    ...d,
  }));
  const points = coords.map((p) => `${p.x},${p.y}`).join(" ");
  const area = `0,${h} ${points} ${w},${h}`;
  const active = hover !== null ? coords[hover] : null;

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * w;
    let nearest = 0;
    let best = Infinity;
    coords.forEach((c, i) => {
      const d = Math.abs(c.x - px);
      if (d < best) {
        best = d;
        nearest = i;
      }
    });
    setHover(nearest);
  };

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full h-16 touch-none"
        preserveAspectRatio="none"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        onTouchStart={(e) => {
          const t = e.touches[0];
          onMove({ clientX: t.clientX, currentTarget: e.currentTarget } as unknown as React.MouseEvent<SVGSVGElement>);
        }}
        onTouchMove={(e) => {
          const t = e.touches[0];
          onMove({ clientX: t.clientX, currentTarget: e.currentTarget } as unknown as React.MouseEvent<SVGSVGElement>);
        }}
        onTouchEnd={() => setHover(null)}
      >
        <polygon points={area} fill={color} opacity={0.12} />
        <polyline points={points} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {active && (
          <>
            <line x1={active.x} y1={0} x2={active.x} y2={h} stroke={color} strokeWidth={1} opacity={0.3} vectorEffect="non-scaling-stroke" />
            <circle cx={active.x} cy={active.y} r={4} fill="hsl(var(--background))" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" />
          </>
        )}
      </svg>
      {active && (
        <div
          className="absolute -top-1 -translate-x-1/2 -translate-y-full bg-foreground text-background text-[11px] font-bold px-2 py-1 rounded-lg shadow-lg pointer-events-none whitespace-nowrap"
          style={{ left: `${(active.x / w) * 100}%` }}
        >
          {unit}{active.value.toLocaleString("ru")}
        </div>
      )}
    </div>
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
  const a = useAdminPanel((s) => s.analytics);
  return (
    <TabsContent value="analytics" className="space-y-4 mt-4">
      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-2">
        <KPI icon={Users} label="Юзеров" value={a.totals.users.toLocaleString("ru")} hint="всего" />
        <KPI icon={Activity} label="Активаций" value={a.totals.activations.toLocaleString("ru")} hint="/start всего" />
        <KPI icon={Users} label="Активных за день" value={a.totals.dau.toString()} hint="за сегодня" />
        <KPI icon={Users} label="Активных за месяц" value={a.totals.mau.toLocaleString("ru")} hint="за месяц" />
        
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
          <Users className="w-4 h-4 text-primary" /> Активные пользователи в день (7д)
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

    </TabsContent>
  );
};
