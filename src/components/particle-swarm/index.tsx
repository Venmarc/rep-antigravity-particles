import { useEffect, useRef } from "react";
import type { GlyphSpec, ParticleSwarm, SwarmOptions } from "./engine";

interface Props extends SwarmOptions {
  className?: string;
  /** morph mode: current glyph (string or positioned recipe) */
  glyph?: GlyphSpec;
  /** morph mode: hover/active state */
  active?: boolean;
}

/**
 * True only when a hardware GPU is positively identified.
 *
 * The probe creates a throwaway WebGL context. On a software rasteriser that
 * can itself block the main thread for seconds, so the result is cached for the
 * page and, crucially, an unrecognised/empty renderer string is treated as
 * software: we take the slow, safe path rather than optimistically assuming a
 * fast GPU and starting the engine inside the load window. (Reading the string
 * as "not software unless it matches SwiftShader" was the bug — a failed probe
 * yielded "", which read as *hardware* and started the engine at 800 ms.)
 */
let gpuProbe: boolean | null = null;
function hasHardwareGPU(): boolean {
  if (gpuProbe !== null) return gpuProbe;
  let renderer = "";
  try {
    const gl = document
      .createElement("canvas")
      .getContext("webgl2") as WebGL2RenderingContext | null;
    const ext = gl?.getExtension("WEBGL_debug_renderer_info");
    if (gl && ext) renderer = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL));
  } catch {
    /* probe is best-effort */
  }
  gpuProbe =
    /nvidia|geforce|radeon|\bamd\b|intel|apple|adreno|mali|powervr|videocore|rtx|gtx|iris|uhd graphics/i.test(
      renderer,
    );
  return gpuProbe;
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
    const softwareGL = !hasHardwareGPU();
    // The long software-GL quiet window protects the audited main page's TBT
    // budget, where the swarm mounts during load. Morph fields mount after load
    // (hover-gated on the day page, or on their own route) and are the content,
    // so they start promptly instead of showing a blank screen for ten seconds.
    const deferForPerf = softwareGL && opts.mode !== "morph";
    const delay = deferForPerf ? 10000 : softwareGL ? 2000 : 800;

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
        // test/probe handles: __swarm is the most recent engine; __swarms
        // maps every live engine to its host so a probe can pick the one
        // that owns a given field (the day page runs two at once)
        const w = window as unknown as {
          __swarm?: unknown;
          __swarms?: { host: HTMLElement; swarm: ParticleSwarm }[];
        };
        w.__swarm = swarm;
        w.__swarms = w.__swarms ?? [];
        w.__swarms.push({ host, swarm });
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
      // clear the test globals only if they still point at THIS engine: after a
      // client-side route change the next swarm must own them, and a stale
      // disposed engine would make the audit read the wrong canvas.
      const w = window as unknown as {
        __swarm?: unknown;
        __swarms?: { host: HTMLElement; swarm: ParticleSwarm }[];
      };
      if (swarm && w.__swarm === swarm) delete w.__swarm;
      if (swarm && w.__swarms) {
        w.__swarms = w.__swarms.filter((e) => e.swarm !== swarm);
      }
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
