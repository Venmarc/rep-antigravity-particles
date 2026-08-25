import { CapsuleHeader } from "../components/capsule-header";
import ParticleSwarmCanvas from "../components/particle-swarm";

/** OX — dark hero. Glowless, flat, antigravity-style restraint.
 *  Hover morph target: the OX monogram (morph-mode swarm behind title). */
export default function OxHero() {
  return (
    <div
      className="relative min-h-[100dvh] overflow-hidden"
      style={{ background: "var(--ox-bg)", color: "var(--ox-fg)" }}
    >
      <ParticleSwarmCanvas className="absolute inset-0" mode="ring" theme="dark" />
      <CapsuleHeader dark />
      <main className="relative z-10 mx-auto flex min-h-[100dvh] max-w-5xl flex-col items-center justify-center px-6 text-center">
        <h1 className="text-[18vw] leading-none font-bold tracking-tighter sm:text-[9rem] select-none">
          OX
        </h1>
        <p className="mt-6 max-w-md text-base" style={{ color: "var(--ox-dim)" }}>
          A study of the antigravity.google particle organism.
          Move the cursor. The field was already there.
        </p>
      </main>
      <section
        className="relative z-10 mx-auto max-w-3xl px-6 pb-32 pt-8 text-center"
        style={{ color: "var(--ox-dim)" }}
      >
        <p className="text-sm leading-relaxed">
          65,536 particles live in a texture. Each one has a home it always
          returns to. The cursor reveals an invisible ring of pressure;
          nothing is attracted to you. Outer particles sway more than inner
          ones, which is why the rim flows like something alive.
        </p>
      </section>
    </div>
  );
}
