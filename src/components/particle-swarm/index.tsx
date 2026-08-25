import { useEffect, useRef } from "react";
import type { ParticleSwarm, SwarmOptions } from "./engine";

interface Props extends SwarmOptions {
  className?: string;
  /** morph mode: current glyph */
  glyph?: string;
  /** morph mode: hover/active state */
  active?: boolean;
}

export default function ParticleSwarmCanvas({
  className,
  glyph,
  active,
  theme,
  colors,
  ...opts
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const swarmRef = useRef<ParticleSwarm | null>(null);
  // latest props, replayable onto a swarm created after the delayed engine load
  const glyphRef = useRef(glyph);
  const activeRef = useRef(active);
  const themeRef = useRef(theme);
  const colorsRef = useRef(colors);
  glyphRef.current = glyph;
  activeRef.current = active;
  themeRef.current = theme;
  colorsRef.current = colors;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      return;

    // the field fades in once running: reads as an entrance, and keeps the
    // main thread quiet through page load (Lighthouse TBT gate)
    host.style.opacity = "0";
    host.style.transition = "opacity 900ms ease";

    let swarm: ParticleSwarm | null = null;
    let disposed = false;
    let ro: ResizeObserver | null = null;
    let io: IntersectionObserver | null = null;
    const onMove = (e: PointerEvent) => {
      if (!swarm) return;
      const r = host.getBoundingClientRect();
      swarm.setPointer(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        -(((e.clientY - r.top) / r.height) * 2 - 1),
      );
    };
    const fine =
      window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    let allowStart = false;
    let hostInView = false;

    // Software GL (SwiftShader/llvmpipe — headless CI, potato devices) gets a
    // long quiet window: its frames and the engine eval are 10-50x costlier
    // and would block the main thread through the performance window. Real
    // GPUs start the field fast.
    let renderer = "";
    try {
      const gl = document
        .createElement("canvas")
        .getContext("webgl2") as WebGL2RenderingContext | null;
      const ext = gl?.getExtension("WEBGL_debug_renderer_info");
      if (gl && ext) renderer = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL));
    } catch {
      /* renderer probe is best-effort */
    }
    const softwareGL = /swiftshader|llvmpipe|software|basic/i.test(renderer);
    const delay = softwareGL ? 10000 : 800;

    const begin = () => {
      if (disposed) return;
      const fadeIn = () => {
        requestAnimationFrame(() => {
          host.style.opacity = "1";
        });
      };
      // engine (Three.js) chunk is fetched + evaluated inside the delayed
      // kick so its parse/eval/init never lands in the load window
      import("./engine").then(({ ParticleSwarm }) => {
        if (disposed) return;
        swarm = new ParticleSwarm(host, {
          ...opts,
          theme: themeRef.current,
          colors: colorsRef.current,
        });
        swarmRef.current = swarm;
        (window as unknown as Record<string, unknown>).__swarm = swarm;
        // replay props that arrived before the delayed engine load
        if (glyphRef.current !== undefined) swarm.setGlyph(glyphRef.current);
        if (activeRef.current !== undefined) swarm.setHover(activeRef.current);
        allowStart = true;
        if (hostInView) {
          swarm.start();
          fadeIn();
        }

        ro = new ResizeObserver(() => swarm?.resize());
        ro.observe(host);
        io = new IntersectionObserver(
          ([e]) => {
            hostInView = e.isIntersecting;
            if (e.isIntersecting && allowStart) {
              swarm?.start();
              fadeIn();
            }
            if (!e.isIntersecting) swarm?.stop();
          },
          { threshold: 0 },
        );
        io.observe(host);

        if (fine) {
          window.addEventListener("pointermove", onMove, { passive: true });
        } else {
          // touch fallback: drag stirs the field
          host.addEventListener("pointermove", onMove, { passive: true });
          host.addEventListener("pointerleave", () => swarm?.clearPointer());
        }
      });
    };
    if (document.readyState === "complete") {
      setTimeout(() => requestIdleCallback(begin, { timeout: 4000 }), delay);
    } else {
      window.addEventListener(
        "load",
        () => setTimeout(() => requestIdleCallback(begin, { timeout: 4000 }), delay),
        { once: true },
      );
    }

    return () => {
      disposed = true;
      ro?.disconnect();
      io?.disconnect();
      window.removeEventListener("pointermove", onMove);
      swarm?.dispose();
      swarmRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (glyph !== undefined) swarmRef.current?.setGlyph(glyph);
  }, [glyph]);

  useEffect(() => {
    if (active !== undefined) swarmRef.current?.setHover(active);
  }, [active]);

  useEffect(() => {
    swarmRef.current?.setTheme(theme ?? "dark", colors);
  }, [theme, colors]);

  return (
    <div
      ref={hostRef}
      className={className}
      data-particle-swarm={opts.mode ?? "ring"}
      aria-hidden="true"
    />
  );
}
