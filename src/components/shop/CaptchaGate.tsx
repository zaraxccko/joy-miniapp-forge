import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { useCaptcha } from "@/store/captcha";
import { useI18n } from "@/lib/i18n";
import { haptic } from "@/lib/telegram";
import { toast } from "sonner";

/**
 * Капча: на canvas-сетке нарисованы 🍓, среди них один 🥥.
 * Цель — тапнуть кокос. 3 ошибки → блок на 30 секунд.
 *
 * Эмодзи рисуются на canvas (не в DOM) — простой бот не сможет
 * прочитать `innerText` или найти target по селектору.
 * Позиции и точка-кокоса перемешиваются при каждом маунте/refresh.
 */

const GRID = 5; // 5x5 = 25 ячеек
const CELLS = GRID * GRID;
const CANVAS_SIZE = 320;
const CELL = CANVAS_SIZE / GRID;
const MAX_ATTEMPTS = 3;
const BLOCK_MS = 30_000;

interface Cell {
  emoji: string;
  rotate: number;
  offsetX: number;
  offsetY: number;
  scale: number;
}

function buildBoard(): { cells: Cell[]; targetIndex: number } {
  const targetIndex = Math.floor(Math.random() * CELLS);
  const cells: Cell[] = Array.from({ length: CELLS }, (_, i) => ({
    emoji: i === targetIndex ? "🥥" : "🍓",
    rotate: (Math.random() - 0.5) * 0.6, // ±0.3 rad
    offsetX: (Math.random() - 0.5) * (CELL * 0.25),
    offsetY: (Math.random() - 0.5) * (CELL * 0.25),
    scale: 0.85 + Math.random() * 0.25,
  }));
  return { cells, targetIndex };
}

export const CaptchaGate = () => {
  const lang = useI18n((s) => s.lang) ?? "ru";
  const pass = useCaptcha((s) => s.pass);
  const tr = (ru: string, en: string) => (lang === "ru" ? ru : en);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [board, setBoard] = useState(() => buildBoard());
  const [attempts, setAttempts] = useState(0);
  const [blockedUntil, setBlockedUntil] = useState<number>(0);
  const [now, setNow] = useState(Date.now());

  // тикающий таймер для блока
  useEffect(() => {
    if (blockedUntil <= now) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [blockedUntil, now]);

  const blocked = blockedUntil > now;
  const blockSecondsLeft = blocked ? Math.ceil((blockedUntil - now) / 1000) : 0;

  // Рисуем доску
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = CANVAS_SIZE * dpr;
    canvas.height = CANVAS_SIZE * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    board.cells.forEach((cell, i) => {
      const col = i % GRID;
      const row = Math.floor(i / GRID);
      const cx = col * CELL + CELL / 2 + cell.offsetX;
      const cy = row * CELL + CELL / 2 + cell.offsetY;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(cell.rotate);
      ctx.scale(cell.scale, cell.scale);
      ctx.font = `${CELL * 0.7}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
      ctx.fillText(cell.emoji, 0, 0);
      ctx.restore();
    });
  }, [board]);

  const refresh = () => {
    haptic("light");
    setBoard(buildBoard());
  };

  const onCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (blocked) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * CANVAS_SIZE;
    const y = ((e.clientY - rect.top) / rect.height) * CANVAS_SIZE;
    const col = Math.floor(x / CELL);
    const row = Math.floor(y / CELL);
    const idx = row * GRID + col;

    if (idx === board.targetIndex) {
      haptic("success");
      toast.success(tr("Добро пожаловать", "Welcome"));
      pass();
      return;
    }

    haptic("error");
    const next = attempts + 1;
    setAttempts(next);
    if (next >= MAX_ATTEMPTS) {
      const until = Date.now() + BLOCK_MS;
      setBlockedUntil(until);
      setNow(Date.now());
      setAttempts(0);
      setBoard(buildBoard());
      toast.error(tr("Слишком много попыток. Подождите 30 сек.", "Too many tries. Wait 30s."));
    } else {
      toast.error(
        tr(
          `Не то. Осталось попыток: ${MAX_ATTEMPTS - next}`,
          `Wrong. Tries left: ${MAX_ATTEMPTS - next}`
        )
      );
      setBoard(buildBoard());
    }
  };

  return (
    <div className="min-h-screen max-w-md mx-auto bg-background flex flex-col items-center justify-center px-6 py-10 text-center">
      <div className="w-20 h-20 rounded-3xl gradient-primary shadow-glow flex items-center justify-center mb-5">
        <ShieldCheck className="w-10 h-10 text-primary-foreground" />
      </div>

      <h1 className="font-display font-extrabold text-3xl leading-tight">
        {tr("Подтверди, что ты не бот", "Prove you're not a bot")}
      </h1>
      <p className="text-muted-foreground mt-3 text-sm leading-relaxed max-w-xs">
        {tr("Найди и тапни ", "Find and tap ")}
        <span className="text-2xl align-middle">🥥</span>
        {tr(" среди ", " among ")}
        <span className="text-2xl align-middle">🍓</span>
      </p>

      <div className="mt-6 bg-card rounded-3xl shadow-card p-3 relative">
        <canvas
          ref={canvasRef}
          onClick={onCanvasClick}
          style={{
            width: CANVAS_SIZE,
            height: CANVAS_SIZE,
            touchAction: "manipulation",
            cursor: blocked ? "not-allowed" : "pointer",
            opacity: blocked ? 0.4 : 1,
            userSelect: "none",
          }}
          aria-label="Captcha"
        />
        {blocked && (
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl bg-background/70 backdrop-blur-sm">
            <div className="text-5xl font-display font-extrabold text-destructive">
              {blockSecondsLeft}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {tr("секунд до новой попытки", "seconds until retry")}
            </div>
          </div>
        )}
      </div>

      <button
        onClick={refresh}
        disabled={blocked}
        className="mt-5 w-full bg-card border border-border font-bold py-4 rounded-2xl active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
      >
        <RefreshCw className="w-5 h-5" />
        {tr("Перемешать", "Shuffle")}
      </button>

      <p className="text-[11px] text-muted-foreground mt-4 max-w-xs">
        {tr(
          "Это нужно, чтобы отсечь ботов. Картинки нарисованы на холсте — обычный скрипт их не прочитает.",
          "This filters out bots. Images are drawn on canvas — scripts can't read them."
        )}
      </p>
    </div>
  );
};
