import { useEffect, useRef, type ReactNode } from "react";

/**
 * Momentum-smoothed page scroll — replicates the antigravity.google recipe
 * (glossary: [Motion] Momentum-smoothed page scroll, status extracted).
 *
 * GSAP ScrollSmoother is used because the glossary entry's Technique line
 * names it as the source's engine; a CSS-only equivalent of inertia scroll
 * with interruptible wheel input does not exist.
 *
 * Extracted config: smooth 0.6, smoothTouch 0.1, normalizeScroll with
 * allowNestedScroll. `effects` is omitted — the source shipped `effects:
 * true` with zero data-speed/data-lag elements, so it was a no-op there.
 * Gates: touch primary pointers get native scroll (ScrollTrigger.isTouch
 * === 1), as does prefers-reduced-motion (the source lacked this gate; it
 * is added here deliberately).
 *
 * Fixed-position chrome (capsule header) must live OUTSIDE this wrapper —
 * the transformed content re-parents fixed elements. Sticky (FadeHeader)
 * works inside.
 */
export default function SmoothScroll({ children }: { children: ReactNode }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let smoother: {
      kill: () => void;
      refresh: () => void;
      scrollTop: (value: number, suppressEvents?: boolean) => void;
    } | null = null;
    let disposed = false;
    let started = false;

    const start = () => {
      if (disposed || started) return;
      started = true;
      // dynamic import keeps gsap (~127 kB) off the critical path. Every path
      // into scrolling (wheel / drag / touch / key) raises this first, so the
      // enhancement is live before the first real scroll.
      Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
        import("gsap/ScrollSmoother"),
      ]).then(([{ gsap }, { ScrollTrigger }, { ScrollSmoother }]) => {
        if (disposed) return;
        gsap.registerPlugin(ScrollTrigger, ScrollSmoother);

        if (ScrollTrigger.isTouch === 1) return; // touch: native scroll

        const wrapper = wrapperRef.current;
        const content = contentRef.current;
        if (!wrapper || !content) return;
        const y = window.scrollY;
        smoother = ScrollSmoother.create({
          wrapper,
          content,
          smooth: 0.6,
          smoothTouch: 0.1,
          normalizeScroll: { allowNestedScroll: true },
        });
        // adopt any position reached on native scroll before we initialised,
        // so taking over never snaps the page back to the top
        if (y > 0) smoother?.scrollTop(y, false);
        // test/probe handle, same pattern as window.__swarm
        (window as unknown as Record<string, unknown>).__smoother = smoother;
      });
    };

    // Initialise on first interaction intent, NOT on a timer. At load the gsap
    // parse/eval is pure cost: pre-paint it delayed LCP to 2.9 s; the same work
    // on a short timer moved into the TBT window and pushed TTI out (1.4 s of
    // blocking). Nothing scrolls without one of these events first, so the
    // enhancement is ready by the time the user actually scrolls — and a load
    // that is never scrolled (a Lighthouse run) never pays for it.
    const events: (keyof WindowEventMap)[] = [
      "wheel",
      "pointermove",
      "touchstart",
      "keydown",
    ];
    for (const ev of events) {
      window.addEventListener(ev, start, { passive: true, once: true });
    }

    return () => {
      disposed = true;
      for (const ev of events) window.removeEventListener(ev, start);
      smoother?.kill();
      if ((window as unknown as Record<string, unknown>).__smoother) {
        delete (window as unknown as Record<string, unknown>).__smoother;
      }
    };
  }, []);

  return (
    <div ref={wrapperRef} data-smooth-wrapper className="min-h-[100dvh]">
      <div ref={contentRef} data-smooth-content>
        {children}
      </div>
    </div>
  );
}
