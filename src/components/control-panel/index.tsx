import { useCallback, useRef, useState, type ReactNode } from "react";

interface DragState {
  px: number;
  py: number;
  sx: number;
  sy: number;
}

/** Freely placeable container: drag anywhere except on interactive children.
 *  Transform-only movement; clamped to the viewport. */
export default function DraggablePanel({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<DragState | null>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  const onMove = useCallback((e: PointerEvent) => {
    const d = drag.current;
    const el = ref.current;
    if (!d || !el) return;
    const nx = d.sx + e.clientX - d.px;
    const ny = d.sy + e.clientY - d.py;
    const r = el.getBoundingClientRect();
    const w = r.width;
    const h = r.height;
    const curX = r.left;
    const curY = r.top;
    // clamp: keep at least 40px of the panel inside the viewport
    const minX = nx + (40 - (curX + w));
    const maxX = nx - (curX + 40 - window.innerWidth);
    const minY = ny + (40 - (curY + h));
    const maxY = ny - (curY + 40 - window.innerHeight);
    setPos({
      x: Math.min(Math.max(nx, minX), maxX),
      y: Math.min(Math.max(ny, minY), maxY),
    });
  }, []);

  const onUp = useCallback(() => {
    drag.current = null;
    setDragging(false);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  }, [onMove]);

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("input, button, a")) return;
    // prevent text selection while dragging the panel background
    e.preventDefault();
    drag.current = { px: e.clientX, py: e.clientY, sx: pos.x, sy: pos.y };
    setDragging(true);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      className={`relative flex flex-col items-center rounded-3xl p-6 backdrop-blur-md transition-shadow duration-300 ${
        dragging ? "cursor-grabbing shadow-2xl" : "cursor-grab"
      } ${className}`}
      style={{
        transform: `translate(${pos.x}px, ${pos.y}px)`,
        background: "color-mix(in srgb, var(--panel-bg) 55%, transparent)",
        boxShadow: dragging
          ? "0 0 0 1px color-mix(in srgb, var(--panel-line) 60%, transparent)"
          : "0 0 0 1px transparent",
        touchAction: "none",
        ...style,
      }}
      data-draggable-panel
      aria-label="Glyph controls. Drag from the background to move."
    >
      {children}
    </div>
  );
}
