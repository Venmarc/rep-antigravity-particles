import { CapsuleHeader } from "../components/capsule-header";
import ParticleSwarmCanvas from "../components/particle-swarm";
import SmoothScroll from "../components/smooth-scroll";

const FEATURES = [
  {
    k: "01",
    t: "Anchored fields",
    d: "Every particle holds a permanent home. Motion is displacement, never migration. The system relaxes instead of chasing.",
  },
  {
    k: "02",
    t: "Pressure rings",
    d: "The cursor commands a soft annulus of outward pressure. Three overlapping bands, one breathing radius, zero attraction.",
  },
  {
    k: "03",
    t: "Layered noise",
    d: "Simplex fields at three frequencies drive wander, shimmer, and rim sway. Amplitude scales with distance from the anchor.",
  },
];

/** Signal — fictional observability product page, light theme.
 *  Restrained glow: none on chrome; a single soft radial behind the hero canvas only.
 *  Fixed capsule header outside the smooth-scroll content (transform re-parents fixed). */
export default function Signal() {
  return (
    <>
      <CapsuleHeader />
      <SmoothScroll>
        <div style={{ background: "var(--sig-bg)", color: "var(--sig-fg)" }}>
      <section className="relative min-h-[92dvh] overflow-hidden">
        <ParticleSwarmCanvas
          className="absolute inset-0"
          mode="ring"
          theme="light"
          density={220}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 45% at 50% 42%, rgba(52,107,241,0.05), transparent 70%)",
          }}
        />
        <div className="relative z-10 mx-auto flex min-h-[92dvh] max-w-4xl flex-col items-center justify-center px-6 text-center">
          <p
            className="mb-4 text-xs font-medium uppercase tracking-[0.25em]"
            style={{ color: "var(--sig-accent)" }}
          >
            Signal
          </p>
          <h1 className="max-w-2xl text-5xl font-semibold tracking-tight sm:text-6xl">
            Your system, rendered as a living thing.
          </h1>
          <p
            className="mt-6 max-w-lg text-lg"
            style={{ color: "var(--sig-dim)" }}
          >
            Sixty-five thousand sensors. One organism. Watch load, latency,
            and errors move like weather instead of dashboards.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-28 pt-8">
        {/* borderless separation: spacing + tone shift only */}
        <div className="grid gap-16 sm:grid-cols-3 sm:gap-10">
          {FEATURES.map((f) => (
            <article key={f.k}>
              <p
                className="text-xs font-mono"
                style={{ color: "var(--sig-accent)" }}
              >
                {f.k}
              </p>
              <h2 className="mt-3 text-xl font-semibold">{f.t}</h2>
              <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--sig-dim)" }}>
                {f.d}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section
        className="px-6 pb-32 pt-16 text-center"
        style={{ background: "rgba(0,0,0,0.02)" }}
      >
        <h2 className="text-3xl font-semibold tracking-tight">
          Feel the field before you read the numbers.
        </h2>
        <a
          href="/playground"
          className="mt-8 inline-block rounded-full px-7 py-3 text-sm font-medium text-white transition-transform duration-300 hover:scale-[1.03]"
          style={{
            background: "var(--sig-fg)",
            transitionTimingFunction: "var(--ease-out)",
          }}
        >
          Open the playground
        </a>
      </section>
        </div>
      </SmoothScroll>
    </>
  );
}
