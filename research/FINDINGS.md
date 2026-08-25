# antigravity.google Particle System — Full Reverse-Engineering

Source: beautified production bundles, pulled 2026-08-24.
Raw files in this folder: `ag-particles.pretty.js` (hero), `ag-morph.pretty.js` (CTA morphs), `ag-smooth.js` (scroll).

---

## Architecture (both systems)

**GPGPU ping-pong simulation.** Not boids, not a swarm sim.

- 65,536 particles = one 256×256 `THREE.DataTexture`, Float32 RGBA.
- Channel packing: `xy = position`, `z = scale`, `w = velocity`.
- Each frame: fullscreen quad renders a "sim" fragment shader that reads the previous state texture and writes new state into a render target. Two render targets alternate (`postRender()` swaps rt1/rt2).
- Rendering pass: a `THREE.Points` mesh with one vertex per texel. Vertex shader reads position from the state texture via `uv`. `gl_PointSize` scales with per-particle scale.
- Initial layout: `poisson-disk-sampling` npm package (kchapelier) on a 500×500 grid. `minDistance = map(density, 0..300 → 10..2)`, `maxDistance = map(density, 0..300 → 11..3)`, tries=20. Density attr default 200 (hero), 50 (CTAs).
- Three.js is bundled in a file named `Mouse.*.js` (~548KB). Camera FOV 40, z=3.1 hero; CTA uses cameraZoom 8.8. Mesh scaled ×5.

## Hero system — why it looks like a living jellyfish

### The core insight
Every particle has a **permanent home** (`refPos`, baked once into a static `uPosRefs` texture). Per frame:

```
pos *= 0.8                                    // decay displacement
finalPos = refPos + noiseDisp + pos * 0.25    // relax back home
```

The cursor never attracts particles. It reveals a field that already exists. Recreations that build "a swarm following the mouse" are structurally wrong.

### The ring (displacement engine)
- Anchor `uRingPos` lerps toward cursor at **0.02/frame** when hovering, **0.01/frame** otherwise. Extremely lazy — blob lags and "dances around" the cursor area.
- Cursor target itself = `intersectionPoint * 0.175 + own simplex-noise drift` — heavily damped and self-moving.
- Idle mode: anchor drifts on a pure noise path (Lissajous-like). The blob wanders with no input.
- Ring radius **breathes**: `.175 + sin(t)*.03 + cos(3t)*.02`.

Displacement mask — three overlapping smoothstep annuli around anchor:

```
t  = smoothstep(R-2*w, R, dist) - smoothstep(R, R+w, dist1)   // wide ring
t2 = same with narrow width w2                                 // tight ring
t3 = smoothstep(R+w2, R, dist)                                // inner fill
t  = t² + t2³*3 + t3*.4 + highFreqNoise*t3*.5 + lowFreqNoise term
```

Push direction — radial outward inside the ring shell only:

```
pos -= (ringPos - (curPos + disp)) * pow(t2, .75) * uRingDisplacement
```

Defaults: `ringWidth .107`, `ringWidth2 .05`, `ringDisplacement .15`.

### Noise layers (all Ashima simplex `snoise`, time-animated)
| Purpose | Freq | Amp |
|---|---|---|
| Medium wander | pos×4 | ±.03 |
| Fine shimmer | pos×20 | ±.005 |
| Ring-edge irregularity | pos×30 | ×t3×.5 |
| Blob-wide swell | pos×2 | ×.6 |
| Sway waves | sin/cos(refPos×20 + time) | ±.02 × clamp(dist,0,1) |

**The jellyfish line:** sway amplitude × distance-from-anchor. Outer particles wave more than inner ones. This plus edge noise = flowy, irregular rim.

### Sprite rendering details everyone misses
- Particles are **not circles**: each point draws an `sdRoundBox(uv, vec2(.5,.2), r=.25)` — a rotated pill.
- Rotation = angle-to-cursor + `snoise(pos×10)*.5` wobble → directional, current-like flow.
- Alpha = `uAlpha * pillMask * smoothstep(0.1, 0.2, vScale)` — particles pop in/out by scale, never bounce. Replacement feel comes from here.
- `discard` when alpha < 0.01.

### Color system (NOT distance-from-cursor)
Gradient driven by a slow-moving low-freq spatial noise field (`noiseColor = snoise(pos×2, t*.5)` remapped to 0..1), then a two-segment mix with split at h=0.8:

```
col = mix(mix(c1,c2,p/.8), mix(c2,c3,(p-.8)/.2), step(.8,p))
```

- Dark theme: `#7189ff` → `#3074f9` → `#000000`; color multiplied by velocity.
- Light theme: `#2c64ed` (blue) → `#f84242` (red) → `#ffcf03` (yellow).
- Orange-outside/blue-inside is an illusion of the moving noise field over even particle spacing.

### Perf tricks
Raycast every other frame (`skipFrame` toggle); IntersectionObserver pauses when offscreen (`resume()/stop()` on clock); antialias+highp+preserveDrawingBuffer; `?gui=true` query param enables Google's dat.GUI debug panel (colors, ring width/width2/displacement/density/scale live-tunable).

## Morph CTA system ({}, org circles)

Same GPGPU base. Differences:

- Shape targets come from **PNG textures** (`/assets/textures/icons/cube.png`, `individual.png`) rasterized to 500×500 canvas.
- **Variable-density Poisson sampling**: density function = pixel red-channel³. Denser where shape is opaque. maxDistance mapped `density 0..300 → 10..50`.
- Each base particle assigned its nearest shape point in a **Web Worker** (with random 25% skip for speed).
- Sim shader adds per-particle **life cycle**: `lifeTime = mod(seed*100 + t*.5, lifeEnd≈3s)` — spawn at home, grow, shrink, die, respawn. Scale envelope via double smoothstep.
- Hover: GSAP tween `hoverProgress` 0→1; `targetPos = mix(refPos, nearestPos, hoverProgress²)`; particles stream toward assigned points, `direction * .01 * smoothstep(.15,0,dist)` easing; scale boost ×1.5 near target while hovering.
- CTA defaults: density 50, particlesScale 0.6, colors `#676A72`/`#FF4641`/`#346BF1`, background dark `#121212`(ish).

## Emoji / arbitrary glyph feasibility

Shapes are just rasterized images sampled by alpha/brightness. Anything `fillText` can draw works: ASCII symbols, unicode, emoji. One change needed: sample the **alpha channel** (emoji render in full color; red-channel sampling would misbehave). Draw white-on-black text to an offscreen canvas, sample alpha or luminance.

## Why prior recreations fail

| Attempt | What's wrong |
|---|---|
| bram.us Houdini worklet | Single radial wave following cursor; no anchored homes, no layered noise octaves, no rotated pill sprites |
| Vortex recreations | Pull particles inward; real system pushes outward within a soft ring while particles spring home |
| Wave recreations | Treat it as a traveling wave; actually per-particle relaxation + replacement via scale-alpha lifecycle |

## Correct terminology

GPGPU / FBO ping-pong simulation · Poisson-disc sampling (fixed & variable density) · layered simplex-flow field · signed-distance sprite rendering (SDF pills) · scroll-independent ambient canvas · radial soft-ring displacement mask · per-particle lifecycle alpha.
