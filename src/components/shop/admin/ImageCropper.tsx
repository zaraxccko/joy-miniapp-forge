import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

interface ImageCropperProps {
  open: boolean;
  src: string | null;
  size?: number;
  onCancel: () => void;
  onConfirm: (croppedDataUrl: string) => void;
}

/**
 * Кадрирование как в Telegram:
 * - Базовая раскладка: картинка вписана в квадрат по принципу `cover`
 *   (минимальный масштаб, при котором квадрат полностью закрыт).
 * - Зум: умножает базовый cover-масштаб (1× … 4×).
 * - Drag: перетаскивание мышью / пальцем, с ограничением, чтобы пустота не появлялась.
 */
export const ImageCropper = ({ open, src, size = 512, onCancel, onConfirm }: ImageCropperProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgElRef = useRef<HTMLImageElement | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1); // 1 = базовый cover
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [box, setBox] = useState(320);

  useEffect(() => {
    if (!open) return;
    setZoom(1);
    setPos({ x: 0, y: 0 });
    setNatural(null);
  }, [src, open]);

  useEffect(() => {
    const update = () => {
      const w = containerRef.current?.clientWidth ?? 320;
      setBox(Math.min(w, 360));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [open]);

  // Базовый cover-размер картинки в CSS-пикселях, чтобы закрыть квадрат box×box.
  const cover = (() => {
    if (!natural) return { w: box, h: box };
    const r = natural.w / natural.h;
    if (r >= 1) {
      // широкая → высота = box, ширина шире
      return { w: box * r, h: box };
    }
    return { w: box, h: box / r };
  })();

  // Минимальный зум, чтобы картинка целиком влезла в квадрат (contain).
  // Для cover-базы это меньшая сторона / большую → <1 для непрямоугольных.
  const minZoom = natural ? Math.min(box / cover.w, box / cover.h) : 1;

  const drawnW = cover.w * zoom;
  const drawnH = cover.h * zoom;

  const clamp = (p: { x: number; y: number }) => {
    const maxX = Math.max(0, (drawnW - box) / 2);
    const maxY = Math.max(0, (drawnH - box) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, p.x)),
      y: Math.min(maxY, Math.max(-maxY, p.y)),
    };
  };

  useEffect(() => {
    setPos((p) => clamp(p));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, box, natural?.w, natural?.h]);

  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    setPos(clamp({
      x: dragRef.current.ox + (e.clientX - dragRef.current.sx),
      y: dragRef.current.oy + (e.clientY - dragRef.current.sy),
    }));
  };
  const onPointerUp = () => { dragRef.current = null; };

  const handleConfirm = () => {
    if (!imgElRef.current || !natural) return;
    // 1 CSS px === (natural.w / cover.w) пикселей исходника при zoom=1.
    // С учётом zoom: 1 CSS px === (natural.w / cover.w / zoom) пикселей исходника.
    const natPerCss = natural.w / cover.w / zoom;
    const cropSize = box * natPerCss;
    const cx = natural.w / 2 - pos.x * natPerCss;
    const cy = natural.h / 2 - pos.y * natPerCss;
    const sx = Math.max(0, Math.min(natural.w - cropSize, cx - cropSize / 2));
    const sy = Math.max(0, Math.min(natural.h - cropSize, cy - cropSize / 2));

    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(imgElRef.current, sx, sy, cropSize, cropSize, 0, 0, size, size);
    onConfirm(canvas.toDataURL("image/jpeg", 0.9));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Кадрирование изображения</DialogTitle>
        </DialogHeader>

        {src && (
          <div className="space-y-4">
            <div ref={containerRef} className="flex justify-center">
              <div
                className="relative overflow-hidden rounded-2xl bg-muted touch-none select-none cursor-grab active:cursor-grabbing"
                style={{ width: box, height: box }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              >
                <img
                  ref={(el) => { imgElRef.current = el; }}
                  src={src}
                  alt=""
                  draggable={false}
                  onLoad={(e) => {
                    const el = e.currentTarget;
                    setNatural({ w: el.naturalWidth, h: el.naturalHeight });
                  }}
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    width: `${drawnW}px`,
                    height: `${drawnH}px`,
                    maxWidth: "none",
                    transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))`,
                    pointerEvents: "none",
                  }}
                />
                <div className="pointer-events-none absolute inset-0 ring-2 ring-background/60 rounded-2xl" />
                <div className="pointer-events-none absolute inset-0">
                  <div className="absolute inset-x-0 top-1/3 border-t border-white/30" />
                  <div className="absolute inset-x-0 top-2/3 border-t border-white/30" />
                  <div className="absolute inset-y-0 left-1/3 border-l border-white/30" />
                  <div className="absolute inset-y-0 left-2/3 border-l border-white/30" />
                </div>
              </div>
            </div>

            <div className="px-2">
              <div className="text-xs text-muted-foreground mb-1">Масштаб ×{zoom.toFixed(2)}</div>
              <Slider
                value={[zoom]}
                min={1}
                max={4}
                step={0.01}
                onValueChange={(v) => setZoom(v[0])}
              />
            </div>

            <div className="text-[11px] text-muted-foreground text-center">
              Перетащите картинку, чтобы выбрать видимую область
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onCancel}>Отмена</Button>
          <Button onClick={handleConfirm}>Сохранить</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
