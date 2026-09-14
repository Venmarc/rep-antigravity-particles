import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FadeHeader } from "../components/capsule-header";
import ParticleSwarmCanvas from "../components/particle-swarm";
import DraggablePanel from "../components/control-panel";
import Polaroid from "../components/polaroid";
import SmoothScroll from "../components/smooth-scroll";
import { HOURS, PALETTES, dayState } from "./day-fields";

/** A Working Day — the CTA morph fields as two hours of one shift.
 *  The day only moves forward: opening a later hour collapses the current
 *  one (instantly — height just changes, no transition) and it stays closed.
 *  Hover (or focus) a live photograph to form its field; drag the note aside
 *  to watch; click the photograph for the full-page field. Coarse pointers
 *  get the formed field without hover. */
export default function Day() {
  const navigate = useNavigate();
  const [theme, setTheme] = useState(dayState.theme);
  // 09:00 opens the day: the first field is on screen at load
  const [open, setOpen] = useState(dayState.open);
  const [hovered, setHovered] = useState(false);
  const [canHover] = useState(
    () => window.matchMedia("(hover: hover) and (pointer: fine)").matches,
  );
  // click vs drag discrimination on the photo cards
  const down = useRef<{ x: number; y: number } | null>(null);
  const pal = PALETTES[theme];

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    dayState.theme = next;
  };

  const advance = (i: number) => {
    if (i <= open) return;
    setOpen(i);
    dayState.open = i;
    // the field under the pointer just collapsed; leave no stale hover
    setHovered(false);
  };

  const openField = (field: "analyst" | "crew") => navigate(`/day/${field}`);

  const cardClick = (e: React.MouseEvent) => {
    // the note is the drag handle: clicks on it must not navigate
    if ((e.target as HTMLElement).closest("[data-draggable-panel]")) return;
    const d = down.current;
    // a note drag ends with mouseup on the card; only plain clicks open
    if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) return;
    const field = (e.currentTarget as HTMLElement).dataset.field;
    if (field === "analyst" || field === "crew") openField(field);
  };

  return (
    // FadeHeader stays OUTSIDE the smooth content: sticky inside a
    // transformed ancestor never sticks, and GSAP's press-time reversion
    // of its managed spacing shifts layout mid-click. Out here it sticks
    // against the real document scroll (the body still scrolls under the
    // fixed wrapper), and the CSS vars still reach it.
    <div
      className="transition-colors duration-500"
      style={
        {
          background: pal.bg,
          color: pal.fg,
          "--panel-bg": pal.bg,
          "--panel-line": pal.line,
          "--pg-bg": pal.bg,
          "--pg-fg": pal.fg,
        } as React.CSSProperties
      }
    >
      {/* ScrollSmoother makes the content wrapper position:fixed, so this
          root collapses and its own background paints nothing — the white
          body would show through and dark-theme text would vanish on it.
          This fixed layer is the page background in every mode. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 transition-colors duration-500"
        style={{ background: pal.bg }}
      />
      <FadeHeader />
      <SmoothScroll>
        <div className="flex min-h-[100dvh] flex-col">
          <main className="mx-auto w-full max-w-2xl flex-1 px-6 pb-24 pt-16">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-lg">
              <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
                A working day
              </h1>
              <p className="mt-4 text-sm leading-relaxed opacity-70">
                Five photographs from one shift. Skipping ahead is allowed;
                going back is not.{" "}
                {canHover
                  ? "Hover a photograph to see who was working; click it for the whole frame."
                  : "Each photograph shows who was working."}
              </p>
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              className="h-11 shrink-0 rounded-full px-4 text-sm backdrop-blur-md transition-all duration-300"
              style={{
                background: `color-mix(in srgb, ${pal.fg} 8%, transparent)`,
                border: `1px solid color-mix(in srgb, ${pal.line} 80%, transparent)`,
              }}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
              data-theme-toggle
            >
              {theme === "dark" ? "☀ Light" : "☾ Dark"}
            </button>
          </div>

          <ol className="mt-14 flex flex-col gap-4" data-day-hours>
            {HOURS.map((h, i) => {
              const state = i < open ? "passed" : i === open ? "open" : "future";
              return (
                <li key={h.clock} data-hour={h.clock} data-hour-state={state}>
                  <button
                    type="button"
                    disabled={state === "passed"}
                    onClick={() => advance(i)}
                    aria-expanded={state === "open"}
                    className="group flex w-full items-center gap-4 py-1 text-left disabled:cursor-default"
                  >
                    <span
                      className="w-12 shrink-0 text-sm tabular-nums"
                      style={{ opacity: state === "passed" ? 0.35 : 0.65 }}
                    >
                      {h.clock}
                    </span>
                    <span className="h-px flex-1" style={{ background: pal.line }} />
                    <span
                      className="text-sm italic"
                      style={{ opacity: state === "passed" ? 0.35 : 1 }}
                    >
                      {h.role}
                    </span>
                    {state === "future" && (
                      <span
                        aria-hidden="true"
                        className="text-xs opacity-50 transition-opacity duration-200 group-hover:opacity-100"
                      >
                        ↓
                      </span>
                    )}
                  </button>

                  {/* collapse/expand is instant on purpose (drawn motion rule):
                      height just changes, no transition */}
                  {h.glyph ? (
                    <div hidden={state !== "open"} className="mt-6">
                      <Polaroid
                        role={h.role}
                        note={h.note}
                        paper={pal.paper}
                        ink={pal.ink}
                        photoBg={pal.photo}
                        rotate={i % 2 ? 1.2 : -1.2}
                        photo={
                          <div
                            className="group absolute inset-0 cursor-pointer outline-none"
                            data-hour-field={h.clock}
                            data-field={h.field}
                            data-open={state === "open" ? "true" : "false"}
                            tabIndex={0}
                            role="button"
                            aria-label={`${h.role} — open the full-page field`}
                            onMouseEnter={() => canHover && setHovered(true)}
                            onMouseLeave={() => canHover && setHovered(false)}
                            onFocus={() => canHover && setHovered(true)}
                            onBlur={() => canHover && setHovered(false)}
                            onPointerDown={(e) => {
                              down.current = { x: e.clientX, y: e.clientY };
                            }}
                            onClick={cardClick}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                if (h.field) openField(h.field);
                              }
                            }}
                          >
                            <ParticleSwarmCanvas
                              className="absolute inset-0"
                              mode="morph"
                              theme={theme}
                              colors={pal.swarmColors}
                              density={50}
                              glyph={h.glyph}
                              active={canHover ? hovered : state === "open"}
                            />
                            <span
                              aria-hidden="true"
                              className="pointer-events-none absolute right-3 top-3 rounded-full px-2.5 py-1 text-xs opacity-0 transition-opacity duration-200 group-hover:opacity-80"
                              style={{
                                color: pal.fg,
                                background: `color-mix(in srgb, ${pal.bg} 55%, transparent)`,
                              }}
                            >
                              ↗
                            </span>
                            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
                              <div className="pointer-events-auto">
                                <DraggablePanel
                                  className="max-w-[17rem]"
                                  style={{ color: pal.fg }}
                                >
                                  <p className="text-sm italic">{h.role}</p>
                                  <p className="mt-1 text-xs leading-relaxed opacity-60">
                                    {canHover
                                      ? "hover the photograph to form — drag this note aside"
                                      : "drag this note aside to watch the field"}
                                  </p>
                                </DraggablePanel>
                              </div>
                            </div>
                          </div>
                        }
                      />
                    </div>
                  ) : state === "open" ? (
                    <div className="mt-6">
                      <Polaroid
                        role={h.role}
                        note={h.note}
                        paper={pal.paper}
                        ink={pal.ink}
                        photoBg={pal.photo}
                        rotate={i % 2 ? 1.2 : -1.2}
                        photo={
                          <div
                            aria-hidden="true"
                            className="absolute inset-0"
                            style={{ background: h.sky }}
                          />
                        }
                      />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </main>
        </div>
      </SmoothScroll>
    </div>
  );
}
