# rep-antigravity-particles

**Solo-variant Pastries rep.** The antigravity.google GPGPU particle swarm, rebuilt from the reverse-engineered spec, then remixed into an original site: OX, Signal and Playground, plus **A working day** (`/day`) — a forward-only accordion of five "hours" in which two of the CTA morph fields were re-cast (the `{}` brace morph → a `%` symbol; the six-ring cluster → six emoji), each opening a full-page field view. OX, Signal and Day carry momentum-smoothed page scroll.

## Quick start

```bash
git clone <repo-url>
cd rep-antigravity-particles
npm install
npm run dev            # interactive dev server
npm run build && npm run preview   # production audit (Lighthouse 95+ gate)
```

## Status

- [x] Research / teardown (`research/FINDINGS.md` — read this first)
- [x] Concept approval — all three concepts (OX, Signal, Playground) as pages
- [x] Scaffold
- [x] Build hero swarm (GPGPU ping-pong, Three.js)
- [x] Build morph variant (glyph/emoji shapes)
- [x] Mobile/touch fallback decision
- [x] Lighthouse 95+ gate — **Performance 99** (last runs: 99/99/99, TBT 30–50 ms, LCP 1.6–1.7 s), A11y 100, BP 100, SEO 100
- [ ] Feel check round 2 (session 4 fixes in — needs Victor's eyes on real GPU)
- [x] README + Playwright specs (`tests/effects.spec.mjs` — 6/6 pass)
- [ ] Session log + glossary flip to `tried` (after feel check)

## What shipped

Routes (`src/main.tsx`, route-split via `React.lazy`; all reachable from the header nav):

- **OX** (`/`) — dark hero. Ring-mode organism follows the cursor: Poisson-disc dust field, high-scale rim band, clean void around the anchor.
- **Signal** (`/signal`) — light theme, blue→red gradient organism, capsule header detaches on scroll.
- **Playground** (`/playground`) — type any glyph/emoji; particles stream into the shape (max-channel canvas sampling so colour emoji interiors survive). Presets activate on click. Shape holds regardless of input focus; clearing the input sends the particles to rest. Intro/input/presets live in a draggable panel (`src/components/control-panel`), and a theme toggle switches between a deep-indigo dark and a warm-peach light palette (no pure white/black) via `engine.setTheme` (live uniform swap, no rebuild).
- **Day** (`/day`) — "A working day": a working day told as five clock hours, forward-only (a later hour collapses the current one instantly — a deliberate drawn motion rule). 09:00 (*the analyst*) forms `%`; 15:00 (*the crew*) forms six emojis in a hexagon. Hover forms the field, click opens it full-page (`/day/analyst`, `/day/crew`) with only a back button; the draggable caption note is theme-aware. Theme toggle persists across the field views.
- **Smooth scroll** (`src/components/smooth-scroll`) — GSAP ScrollSmoother on OX / Signal / Day. Initialises on first interaction intent (wheel/pointer/touch/key), not on a timer: at load the gsap parse/eval is pure cost (pre-paint it delayed LCP to 2.9 s, on a timer it blew TBT to 1.4 s). The page scrolls natively until the first intent.

Engine: `src/components/particle-swarm/engine.ts` (GPGPU ping-pong, ring + morph sim shaders, adaptive frame-skip). Wrapper: `src/components/particle-swarm/index.tsx` (deferred load, fade-in entrance, pointer/touch/reduced-motion handling).

## Tuning constants (current, and why they deviate from the original)

The original's shipped values are in `research/ag-particles.pretty.js` + `scripts/agdom.mjs` (DOM dump). Deliberate deviations, driven by GPU probing (`scripts/blobmap.mjs`, `knownscale.mjs`, `match-pills.mjs`):

| Param | Original | Ours | Why |
|---|---|---|---|
| meshScale (ring) | 5 | 5 | restored — the earlier "rim off-screen" finding used a projection that assumed a 768px canvas (real: 996px) |
| particlesScale (ring) | 0.59–0.65 | 0.6 | feel-check verdict (session 4): 2.5 made pills ~3x the reference and dust read as pills, not specks; 0.6 restores the original's on-screen scale and the dust/rim size contrast |
| ringWidth2 | 0.107 | 0.14 | more rim population |
| rim sharpness | `pow(t2,3)`, `t += t2*3` | `pow(t2,6)`, `t += t2*5` | concentrates scale at the band peak → readable rim instead of a diffuse halo; displacement width preserved via `pow(t2,.375)` |
| density (ring) | 230 | 300 | rim population |
| morph step/relaxation | .02/.1/.2 | .035/.18/.3 | frame-rate compensation for the adaptive frame-skip |
| render scale | native | 0.75, MSAA off | fill-cost; pills are SDF-antialiased in-shader anyway |
| first frame | immediate | after `load` + idle (0.8s hardware GL / 10s software GL) + 900ms fade-in | keeps main thread quiet through load; software-GL devices don't animate through it. Hardware is only assumed when the probe positively recognises a GPU — an empty/unrecognised renderer string now takes the slow path (it previously read as "hardware" and started the engine inside the load window) |
| smooth scroll | GSAP ScrollSmoother, created at init | same, created on first interaction intent | Lighthouse: creation during load delayed LCP to 2.9 s; on a short timer the gsap eval moved into the TBT window (1.4 s, TTI 7.6 s). Interaction-gated → LCP 1.7 s, TBT 30 ms |

## Debug tooling (`scripts/`, run with `NODE_PATH=~/.agents/playwright-core/node_modules`)

- `audit-build.mjs` — full screenshot set + console error check → `screenshots/build-check/`. Covers OX / Signal / Playground / Day / the full-page field views / a smooth-scroll progression probe, and waits for each morph to actually settle (`waitFormed`, targeting the engine that owns a given field via `window.__swarms`).
- `blobmap.mjs` — projects hi-scale state texels to screen px (geometry questions)
- `knownscale.mjs` — freezes the sim, injects a known uniform scale, verifies the pointSize formula
- `match-pills.mjs` — matches rendered pills to state texels (render/readback consistency)
- `correlate.mjs`, `experiment.mjs`, `whichrt.mjs`, `uniforms.mjs`, `probe-canvas.mjs`, `freeze-compare.mjs`, `shrink-test.mjs` — live probes
- `grab-reference.mjs`, `grab-main.mjs`, `agdom.mjs` — hit the live antigravity.google site; delete before any public release of this repo

## Touch/mobile fallback (decided)

- Coarse pointer: drag on the canvas stirs the field (`pointermove` on host, not window).
- `prefers-reduced-motion`: engine never constructed.
- Off-screen: IntersectionObserver stops the loop.

## Verification

```bash
npm run build
npm run preview            # :4173
NODE_PATH=~/.agents/playwright-core/node_modules node scripts/audit-build.mjs
NODE_PATH=~/.agents/playwright-core/node_modules node tests/effects.spec.mjs
CHROME_PATH=/opt/brave.com/brave/brave npx lighthouse http://127.0.0.1:4173 \
  --chrome-flags="--incognito --disable-extensions --headless=new --no-sandbox"
```

Lighthouse note: the score depends on the software-GL quiet window; real-GPU devices start the field at ~0.8s.
