import type { Category } from "@/types/shop";
import { haptic } from "@/lib/telegram";
import { cn } from "@/lib/utils";
import { useI18n, useT } from "@/lib/i18n";
import { loc } from "@/lib/loc";

interface CategoryPillsProps {
  categories: Category[];
  active: string;
  onChange: (slug: string) => void;
}

export const CategoryPills = ({ categories, active, onChange }: CategoryPillsProps) => {
  const t = useT();
  const lang = useI18n((s) => s.lang) ?? "ru";
  const all = { slug: "all", name: t("cat.all"), emoji: "✨" };
  const list = [all, ...categories];

  return (
    <div className="flex gap-2 overflow-x-auto pb-3 px-5 no-scrollbar -mx-0">
      {list.map((c) => {
        const isActive = c.slug === active;
        return (
          <button
            key={c.slug}
            onClick={() => {
              haptic("light");
              onChange(c.slug);
            }}
            className={cn(
              "shrink-0 px-4 py-2.5 rounded-full text-[13px] font-semibold whitespace-nowrap transition-[var(--transition-base)] flex items-center gap-1.5 active:scale-95",
              isActive
                ? "gradient-primary text-primary-foreground shadow-glow"
                : "bg-card text-foreground shadow-card"
            )}
          >
            <span className="text-base">{c.emoji}</span>
            {loc(c.name, lang)}
          </button>
        );
      })}
    </div>
  );
};

