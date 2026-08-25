// Three.js justified under Pastries AGENTS.md hard rule 2: GPGPU ping-pong
// simulation needs float render targets + custom shaders; Three's
// WebGLRenderTarget/DataTexture/Points save ~300 lines vs raw WebGL2.
import * as THREE from "three";

/* ------------------------------------------------------------------ */
/* Shared GLSL                                                         */
/* ------------------------------------------------------------------ */

const NOISE_GLSL = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);
  const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(
      i.z+vec4(0.0,i1.z,i2.z,1.0))
    + i.y+vec4(0.0,i1.y,i2.y,1.0))
    + i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;
  vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
`;

/* ------------------------------------------------------------------ */
/* Poisson-disc sampling (Bridson, fixed density)                      */
/* ------------------------------------------------------------------ */

function poissonDisc(
  size: number,
  minDist: number,
  maxDist: number,
  tries = 20,
  densityFn?: (p: [number, number]) => number,
  rng: () => number = Math.random,
): [number, number][] {
  // Variable-density path uses maxDist as cell metric; fixed otherwise.
  const cell = Math.max(minDist, 1) / Math.SQRT2;
  const gw = Math.ceil(size / cell);
  const grid: number[] = new Array(gw * gw).fill(-1);
  const pts: [number, number][] = [];
  const active: number[] = [];

  const fits = (p: [number, number], md: number): boolean => {
    if (p[0] < 0 || p[1] < 0 || p[0] >= size || p[1] >= size) return false;
    const gx = Math.floor(p[0] / cell);
    const gy = Math.floor(p[1] / cell);
    const r = Math.ceil(md / cell);
    const md2 = md * md;
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const nx = gx + dx,
          ny = gy + dy;
        if (nx < 0 || ny < 0 || nx >= gw || ny >= gw) continue;
        const idx = grid[ny * gw + nx];
        if (idx < 0) continue;
        const q = pts[idx];
        const ddx = q[0] - p[0],
          ddy = q[1] - p[1];
        if (ddx * ddx + ddy * ddy < md2) return false;
      }
    return true;
  };

  const first: [number, number] = [rng() * size, rng() * size];
  if (densityFn && densityFn(first) <= 0) {
    // find any valid seed
    let found = false;
    for (let i = 0; i < 500 && !found; i++) {
      const c: [number, number] = [rng() * size, rng() * size];
      if (densityFn(c) > 0) {
        first[0] = c[0];
        first[1] = c[1];
        found = true;
      }
    }
    if (!found) return pts;
  }
  pts.push(first);
  active.push(0);
  grid[Math.floor(first[1] / cell) * gw + Math.floor(first[0] / cell)] = 0;

  while (active.length) {
    const ai = Math.floor(rng() * active.length);
    const cur = pts[active[ai]];
    const curDensity = densityFn ? densityFn(cur) : 1;
    const localMin = densityFn ? Math.max(minDist, 1) : minDist;
    let placed = false;
    for (let t = 0; t < tries; t++) {
      const a = rng() * Math.PI * 2;
      const d =
        localMin +
        (maxDist - localMin) *
          (densityFn ? curDensity : rng());
      const np: [number, number] = [
        cur[0] + Math.cos(a) * d,
        cur[1] + Math.sin(a) * d,
      ];
      const md = densityFn
        ? Math.max(minDist, 1) +
          (maxDist - Math.max(minDist, 1)) * Math.pow(densityFn(np), 0.5)
        : minDist + (maxDist - minDist) * rng();
      if (fits(np, md)) {
        pts.push(np);
        grid[Math.floor(np[1] / cell) * gw + Math.floor(np[0] / cell)] =
          pts.length - 1;
        active.push(pts.length - 1);
        placed = true;
        break;
      }
    }
    if (!placed) active.splice(ai, 1);
  }
  return pts;
}

/* ------------------------------------------------------------------ */
/* Glyph rasterization -> morph target points                          */
/* ------------------------------------------------------------------ */

export function sampleGlyph(
  text: string,
  density = 60,
): { pts: [number, number][] } {
  const S = 500;
  const cv = document.createElement("canvas");
  cv.width = S;
  cv.height = S;
  const ctx = cv.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let fontSize = 380;
  ctx.font = `700 ${fontSize}px ui-sans-serif, system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
  // shrink until it fits
  while (
    ctx.measureText(text).width > S * 0.86 &&
    fontSize > 40
  ) {
    fontSize *= 0.85;
    ctx.font = `700 ${Math.round(fontSize)}px ui-sans-serif, system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
  }
  ctx.fillText(text, S / 2, S / 2 + fontSize * 0.05);

  const img = ctx.getImageData(0, 0, S, S).data;
  // white-on-black raster: red channel = glyph luminance
  // (alpha is 255 everywhere on the opaque canvas)
  const alphaAt = (x: number, y: number): number => {
    const xi = Math.max(0, Math.min(S - 1, Math.round(x)));
    const yi = Math.max(0, Math.min(S - 1, Math.round(y)));
    return img[(yi * S + xi) * 4] / 255;
  };

  // Jittered grid sampling, glyph interior only (alpha > 0.5).
  // Spacing tightens where alpha is high -> denser glyph cores.
  const pts: [number, number][] = [];
  const step = 1.6 + (density / 300) * 3.2;
  for (let y = step / 2; y < S; y += step) {
    for (let x = step / 2; x < S; x += step) {
      const jx = x + (Math.random() - 0.5) * step;
      const jy = y + (Math.random() - 0.5) * step;
      const a = alphaAt(jx, jy);
      if (a > 0.5 && Math.random() < Math.pow(a, 1.5)) {
        pts.push([jx, jy]);
      }
    }
  }
  return { pts };
}

/* ------------------------------------------------------------------ */
/* CPU value noise (idle drift)                                        */
/* ------------------------------------------------------------------ */

function hash1(n: number): number {
  const s = Math.sin(n) * 43758.5453123;
  return s - Math.floor(s);
}
function vnoise(x: number): number {
  const i = Math.floor(x),
    f = x - i;
  const u = f * f * (3 - 2 * f);
  return hash1(i) * (1 - u) + hash1(i + 1) * u;
}

/* ------------------------------------------------------------------ */
/* Shaders                                                             */
/* ------------------------------------------------------------------ */

const SIM_VERT = /* glsl */ `
void main(){ gl_Position = vec4(position, 1.0); }
`;

// Ring mode — anchored homes + outward soft-ring displacement + layered noise.
const SIM_FRAG_RING = /* glsl */ `
precision highp float;
uniform sampler2D uPosition;
uniform sampler2D uPosRefs;
uniform vec2 uRingPos;
uniform float uTime;
uniform float uRingRadius;
uniform float uRingWidth;
uniform float uRingWidth2;
uniform float uRingDisplacement;
${NOISE_GLSL}
void main(){
  vec2 simTC = gl_FragCoord.xy / vec2(256.0);
  vec4 pFrame = texture2D(uPosition, simTC);
  float scale = pFrame.z;
  float velocity = pFrame.w;
  vec2 refPos = texture2D(uPosRefs, simTC).xy;

  float time = uTime * .5;
  vec2 cur = refPos;
  vec2 pos = pFrame.xy * .8;

  float dist = distance(cur, uRingPos);
  float n0 = snoise(vec3(cur * .2 + vec2(18.4924, 72.9744), time * .5));
  float dist1 = distance(cur + n0 * .005, uRingPos);

  float t  = smoothstep(uRingRadius - uRingWidth * 2., uRingRadius, dist)
           - smoothstep(uRingRadius, uRingRadius + uRingWidth, dist1);
  float t2 = smoothstep(uRingRadius - uRingWidth2 * 2., uRingRadius, dist)
           - smoothstep(uRingRadius, uRingRadius + uRingWidth2, dist1);
  float t3 = 1.0 - smoothstep(uRingRadius, uRingRadius + uRingWidth2, dist);
  t  = pow(t, 2.);
  // sharpened rim: scale concentrates at the band peak instead of a wide halo
  // (taste deviation from the original's pow(.,3); displacement width preserved
  // below via pow(t2, .375) == the original's pow(pow(t2raw,3), .75))
  t2 = pow(t2, 6.);
  t += t2 * 5.;
  t += t3 * .4;
  t += snoise(vec3(cur * 30. + vec2(11.4924, 12.9744), time * .5)) * t3 * .5;
  float nS = snoise(vec3(cur * 2. + vec2(18.4924, 72.9744), time * .5));
  t += pow((nS + 1.5) * .5, 2.) * .6;

  float n1 = snoise(vec3(cur * 4.  + vec2(88.494, 32.4397),  time * .35));
  float n2 = snoise(vec3(cur * 4.  + vec2(50.904, 120.947),  time * .35));
  float n3 = snoise(vec3(cur * 20. + vec2(18.4924, 72.9744), time * .5));
  float n4 = snoise(vec3(cur * 20. + vec2(50.904, 120.947),  time * .5));

  vec2 disp = vec2(n1, n2) * .03 + vec2(n3, n4) * .005;
  disp.x += sin(refPos.x * 20. + time * 4.) * .02 * clamp(dist, 0., 1.);
  disp.y += cos(refPos.y * 20. + time * 3.) * .02 * clamp(dist, 0., 1.);

  pos -= (uRingPos - (cur + disp)) * pow(t2, .375) * uRingDisplacement;

  float scaleDiff = (t - scale) * .2;
  scale += scaleDiff;

  vec2 finalPos = cur + disp + pos * .25;
  velocity *= .5;
  velocity += scale * .25;

  gl_FragColor = vec4(finalPos, scale, velocity);
}
`;

// Morph mode — lifecycle spawn/death + eased stream toward assigned glyph point.
const SIM_FRAG_MORPH = /* glsl */ `
precision highp float;
uniform sampler2D uPosition;
uniform sampler2D uPosRefs;
uniform sampler2D uPosNearest;
uniform float uIsHovering;
uniform float uTime;
${NOISE_GLSL}
vec2 hash(vec2 p){
  p = vec2(dot(p, vec2(2127.1, 81.17)), dot(p, vec2(1269.5, 283.37)));
  return fract(sin(p) * 43758.5453);
}
void main(){
  vec2 simTC = gl_FragCoord.xy / vec2(256.0);
  vec4 pFrame = texture2D(uPosition, simTC);
  float scale = pFrame.z;
  vec2 refPos = texture2D(uPosRefs, simTC).xy;
  vec2 nearestPos = texture2D(uPosNearest, simTC).xy;
  float seed  = hash(simTC).x;
  float seed2 = hash(simTC).y;

  float time = uTime * .5;
  float lifeEnd = 3. + sin(seed2 * 100.) * 1.;
  float lifeTime = mod(seed * 100. + time, lifeEnd);

  // gentle ambient shimmer so idle state stays alive
  float n1 = snoise(vec3(refPos * 4. + vec2(88.494, 32.4397), time * .35));
  float n2 = snoise(vec3(refPos * 4. + vec2(50.904, 120.947), time * .35));
  vec2 disp = vec2(n1, n2) * .012;

  vec2 pos = pFrame.xy;
  vec2 targetPos = mix(refPos, nearestPos, uIsHovering * uIsHovering) + disp * (1. - uIsHovering);
  vec2 dir = normalize(targetPos - pos) * .035;
  float dist = length(targetPos - pos);
  float distStrength = 1.0 - smoothstep(0., .15, dist);
  if (dist > 0.005) pos += dir * distStrength;

  if (lifeTime < .01) { pos = refPos + disp; scale = 0.; }

  float targetScale =
      smoothstep(.01, .5, lifeTime) - smoothstep(.5, 1., lifeTime / lifeEnd);
  targetScale +=
      (1.0 - smoothstep(0., .1, smoothstep(.001, .1, dist))) * 1.5 * uIsHovering;
  scale += (targetScale - scale) * .18;

  vec2 diff = (pos - pFrame.xy) * .3;
  gl_FragColor = vec4(pFrame.xy + diff, scale, smoothstep(.15, .001, dist) * uIsHovering);
}
`;

const RENDER_VERT = /* glsl */ `
precision highp float;
attribute vec4 seeds;
uniform sampler2D uPosition;
uniform float uTime;
uniform float uParticleScale;
uniform float uPixelRatio;
varying vec4 vSeeds;
varying float vVelocity;
varying vec2 vLocalPos;
varying vec2 vScreenPos;
varying float vScale;
void main(){
  vec4 pos = texture2D(uPosition, uv);
  vSeeds = seeds;
  vVelocity = pos.w;
  vScale = pos.z;
  vLocalPos = pos.xy;
  vec4 viewSpace = modelViewMatrix * vec4(vec3(pos.xy, 0.), 1.0);
  gl_Position = projectionMatrix * viewSpace;
  vScreenPos = gl_Position.xy;
  gl_PointSize = (vScale * 7.) * (uPixelRatio * 0.5) * uParticleScale;
}
`;

const RENDER_FRAG = /* glsl */ `
precision highp float;
varying vec4 vSeeds;
varying vec2 vScreenPos;
varying vec2 vLocalPos;
varying float vScale;
varying float vVelocity;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uRingPos;
uniform vec2 uRez;
uniform float uAlpha;
uniform float uTime;
uniform int uColorScheme;
${NOISE_GLSL}
float sdRoundBox(in vec2 p, in vec2 b, in vec4 r){
  r.xy = (p.x > 0.0) ? r.xy : r.zw;
  r.x  = (p.y > 0.0) ? r.x  : r.y;
  vec2 q = abs(p) - b + r.x;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r.x;
}
vec2 rotate(vec2 v, float a){
  float s = sin(a); float c = cos(a);
  mat2 m = mat2(c, s, -s, c);
  return m * v;
}
void main(){
  float uBorderSize = 0.2;
  float ratio = uRez.x / uRez.y;

  float noiseAngle = snoise(vec3(vLocalPos * 10. + vec2(18.4924, 72.9744), uTime * .85));
  float noiseColor = snoise(vec3(vLocalPos * 2. + vec2(74.664, 91.556), uTime * .5));
  noiseColor = (noiseColor + 1.) * .5;

  float angle = atan(vLocalPos.y - uRingPos.y, vLocalPos.x - uRingPos.x);

  vec2 uv = gl_PointCoord.xy;
  uv -= vec2(0.5);
  uv.y *= -1.;
  uv = rotate(uv, -angle + noiseAngle * .5);

  vec2 tuv = vScreenPos;
  tuv = rotate(tuv, uTime);
  tuv.y *= 1. / ratio;
  tuv += .5;

  float h = 0.8;
  float progress = smoothstep(0., .75, pow(noiseColor, 2.));
  vec3 col = mix(
    mix(uColor1, uColor2, progress / h),
    mix(uColor2, uColor3, (progress - h) / (1.0 - h)),
    step(h, progress)
  );

  float dist = sqrt(dot(uv, uv));
  float dr = .5;
  float t = 1.0 - smoothstep(dr - uBorderSize, dr + uBorderSize + .0001, dist);
  t = clamp(t, 0., 1.);

  float rounded = sdRoundBox(uv, vec2(0.5, 0.2), vec4(.25));
  rounded = 1.0 - smoothstep(0., .1, rounded);

  float a = uAlpha * rounded * smoothstep(0.1, 0.2, vScale);
  if (a < 0.01) discard;

  vec3 color = clamp(col, 0., 1.);
  color = mix(color, color * clamp(vVelocity, 0., 1.), float(uColorScheme));
  gl_FragColor = vec4(color, clamp(a, 0., 1.));
}
`;

/* ------------------------------------------------------------------ */
/* Engine                                                              */
/* ------------------------------------------------------------------ */

export interface SwarmOptions {
  mode?: "ring" | "morph";
  theme?: "dark" | "light";
  density?: number;
  particlesScale?: number;
  meshScale?: number;
  colors?: [string, string, string];
  ringWidth?: number;
  ringWidth2?: number;
  ringDisplacement?: number;
}

const SIZE = 256;

export class ParticleSwarm {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();
  private simScene = new THREE.Scene();
  private simCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private rtA!: THREE.WebGLRenderTarget;
  private rtB!: THREE.WebGLRenderTarget;
  private posTex!: THREE.DataTexture;
  private refTex!: THREE.DataTexture;
  private nearTex: THREE.DataTexture | null = null;
  private simMat!: THREE.ShaderMaterial;
  private renderMat!: THREE.ShaderMaterial;
  private points!: THREE.Points;

  private mode: "ring" | "morph";
  private theme: "dark" | "light";
  private count = 0;
  private everRendered = false;
  private time = 0;
  private lastT = 0;
  private frameNo = 0;
  /** render 1-in-N rAF frames; N adapts to measured frame cost (1=every) */
  private skip = 2;
  private rafId = 0;
  private running = false;

  private pointerPos = new THREE.Vector2(0, 0);
  private ringPos = new THREE.Vector2(0, 0);
  private cursorGoal = new THREE.Vector2(0, 0);
  private hasPointer = false;
  private hoverProgress = 0;
  private hoverGoal = 0;

  private opts: Required<
    Pick<SwarmOptions, "density" | "particlesScale" | "meshScale">
  > &
    SwarmOptions;

  constructor(
    private container: HTMLElement,
    opts: SwarmOptions = {},
  ) {
    this.mode = opts.mode ?? "ring";
    this.theme = opts.theme ?? "dark";
    this.opts = {
      density: opts.density ?? (this.mode === "ring" ? 300 : 50),
      // ring: feel-check verdict — 2.5 made pills 3x the reference size and
      // dust read as pills, not specks. 0.6 puts the rim near the original's
      // on-screen pill size and drops unactivated dust to 1-2px specs, which
      // restores the size contrast the void needs; morph CTAs stay at 0.6
      particlesScale: opts.particlesScale ?? (this.mode === "ring" ? 0.6 : 0.6),
      // ring: mesh 3.5 frames the ring band (R+ringWidth2 = 0.28 mesh) inside
      // the frustum; at 5 the rim lands off-screen top/bottom
      meshScale: opts.meshScale ?? (this.mode === "ring" ? 5 : 5),
      ...opts,
    };

    const w = container.offsetWidth || 800;
    const h = container.offsetHeight || 600;
    const pr = Math.min(window.devicePixelRatio || 1, 2);

    this.renderer = new THREE.WebGLRenderer({
      // MSAA off: the pill shapes are SDF-antialiased in the fragment shader;
      // hardware AA is pure fill-cost, fatal under software GL
      antialias: false,
      alpha: true,
      powerPreference: "high-performance",
      precision: "highp",
    });
    this.renderer.extensions.get("EXT_color_buffer_float");
    this.renderer.setPixelRatio(pr);
    // render below native resolution and let CSS upscale: the pill field is
    // soft-edged SDF shapes, so 0.75x is visually near-lossless and cuts
    // fill cost ~1.8x (decisive under software GL)
    const scale = 0.75;
    this.renderer.setSize(w * scale, h * scale, false);
    this.renderer.setClearColor(0x000000, 0);
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";

    this.camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 100);
    // ring mode frames like the hero (z 3.1); morph mode zooms out to frame
    // the glyph (z 8.8) so only the target neighborhood is on screen.
    this.camera.position.z = this.mode === "morph" ? 8.8 : 3.1;

    this.buildState();
    this.buildMaterials();
    this.buildPoints();
    this.loop = this.loop.bind(this);
  }

  /* ---------- state ---------- */

  private buildState() {
    const map = (v: number, a: number, b: number, c: number, d: number) =>
      ((v - a) * (d - c)) / (b - a) + c;
    const minD = map(this.opts.density, 0, 300, 10, 2);
    const maxD = map(this.opts.density, 0, 300, 11, 3);
    const pts = poissonDisc(500, minD, maxD, 20).slice(0, SIZE * SIZE);
    this.count = pts.length;

    const data = new Float32Array(SIZE * SIZE * 4);
    for (let i = 0; i < this.count; i++) {
      data[i * 4 + 0] = (pts[i][0] - 250) / 250;
      data[i * 4 + 1] = (pts[i][1] - 250) / 250;
      data[i * 4 + 2] = 0;
      data[i * 4 + 3] = 0;
    }
    this.posTex = new THREE.DataTexture(
      data,
      SIZE,
      SIZE,
      THREE.RGBAFormat,
      THREE.FloatType,
    );
    this.posTex.needsUpdate = true;
    this.refTex = this.posTex.clone();
    this.refTex.needsUpdate = true;

    const mkRT = () =>
      new THREE.WebGLRenderTarget(SIZE, SIZE, {
        wrapS: THREE.ClampToEdgeWrapping,
        wrapT: THREE.ClampToEdgeWrapping,
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        format: THREE.RGBAFormat,
        type: THREE.FloatType,
        depthBuffer: false,
        stencilBuffer: false,
      });
    this.rtA = mkRT();
    this.rtB = mkRT();
  }

  private buildMaterials() {
    const dark = this.theme === "dark";
    const colors = this.opts.colors ??
      (dark
        ? ["#7189ff", "#3074f9", "#000000"]
        : ["#2c64ed", "#f84242", "#ffcf03"]);

    const frag =
      this.mode === "ring" ? SIM_FRAG_RING : SIM_FRAG_MORPH;
    this.simMat = new THREE.ShaderMaterial({
      uniforms: {
        uPosition: { value: null },
        uPosRefs: { value: this.refTex },
        ...(this.mode === "ring"
          ? {
              uRingPos: { value: this.ringPos },
              uRingRadius: { value: 0.175 },
              // original main-particles DOM values (the interactive organism
              // section): knife-edge wide ring, broad t2 band, strong push
              uRingWidth: { value: this.opts.ringWidth ?? 0.006 },
              uRingWidth2: { value: this.opts.ringWidth2 ?? 0.14 },
              uRingDisplacement: {
                value: this.opts.ringDisplacement ?? 0.62,
              },
            }
          : {
              uPosNearest: { value: null },
              uIsHovering: { value: 0 },
            }),
        uTime: { value: 0 },
      },
      vertexShader: SIM_VERT,
      fragmentShader: frag,
      depthTest: false,
      depthWrite: false,
    });
    this.simScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.simMat));

    this.renderMat = new THREE.ShaderMaterial({
      uniforms: {
        uPosition: { value: null },
        uTime: { value: 0 },
        uColor1: { value: new THREE.Color(colors[0]) },
        uColor2: { value: new THREE.Color(colors[1]) },
        uColor3: { value: new THREE.Color(colors[2]) },
        uRingPos: { value: this.ringPos },
        uRez: {
          value: new THREE.Vector2(
            this.renderer.domElement.width,
            this.renderer.domElement.height,
          ),
        },
        uAlpha: { value: 1 },
        uParticleScale: { value: this.particleScale() },
        uPixelRatio: { value: this.renderer.getPixelRatio() },
        // original polarity: dark theme = 0 = NO velocity dimming;
        // the velocity multiply is a light-theme effect
        uColorScheme: { value: dark ? 0 : 1 },
      },
      vertexShader: RENDER_VERT,
      fragmentShader: RENDER_FRAG,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
  }

  private buildPoints() {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(this.count * 3);
    const uvs = new Float32Array(this.count * 2);
    const seeds = new Float32Array(this.count * 4);
    for (let i = 0; i < this.count; i++) {
      uvs[i * 2] = (i % SIZE) / SIZE;
      uvs[i * 2 + 1] = Math.floor(i / SIZE) / SIZE;
      seeds[i * 4] = Math.random();
      seeds[i * 4 + 1] = Math.random();
      seeds[i * 4 + 2] = Math.random();
      seeds[i * 4 + 3] = Math.random();
    }
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    geo.setAttribute("seeds", new THREE.BufferAttribute(seeds, 4));
    this.points = new THREE.Points(geo, this.renderMat);
    this.points.scale.setScalar(this.opts.meshScale);
    this.scene.add(this.points);
  }

  private particleScale(): number {
    // CSS size (drawing buffer is 0.75x for fill-cost); matches the original's
    // width/pixelRatio/2000 basis
    const px = this.container.offsetWidth || 800;
    return (px / 2000) * this.opts.particlesScale;
  }

  /* ---------- public API ---------- */

  /** Pointer in NDC (-1..1). Anchors the ring / influences nothing in morph mode. */
  setPointer(ndcX: number, ndcY: number) {
    const halfH = Math.tan((40 * Math.PI) / 360) * this.camera.position.z;
    const halfW = halfH * this.camera.aspect;
    // world -> mesh-local (mesh scale divides out)
    this.pointerPos.set(
      (ndcX * halfW) / this.opts.meshScale,
      (ndcY * halfH) / this.opts.meshScale,
    );
    this.hasPointer = true;
  }

  clearPointer() {
    this.hasPointer = false;
  }

  setHover(on: boolean) {
    this.hoverGoal = on ? 1 : 0;
  }

  /** Live theme switch: swaps palette uniforms, no rebuild. */
  setTheme(theme: "dark" | "light", colors?: [string, string, string]) {
    this.theme = theme;
    const c = colors ??
      (theme === "dark"
        ? ["#7189ff", "#3074f9", "#000000"]
        : ["#2c64ed", "#f84242", "#ffcf03"]);
    (this.renderMat.uniforms.uColor1.value as THREE.Color).set(c[0]);
    (this.renderMat.uniforms.uColor2.value as THREE.Color).set(c[1]);
    (this.renderMat.uniforms.uColor3.value as THREE.Color).set(c[2]);
    this.renderMat.uniforms.uColorScheme.value = theme === "dark" ? 0 : 1;
  }

  /** Morph mode: retarget all particles to a glyph (any unicode/emoji). */
  setGlyph(text: string) {
    if (this.mode !== "morph") return;
    const { pts } = sampleGlyph(text, this.opts.density);
    if (!pts.length) return;
    // nearest shape-point per base particle (brute force, runs once per glyph)
    const assign = new Float32Array(SIZE * SIZE * 4);
    const stride = Math.max(1, Math.floor(pts.length / 4000));
    const shapePts = pts.filter((_, i) => i % stride === 0);
    const data = this.refTex.image.data as unknown as Float32Array;
    for (let i = 0; i < this.count; i++) {
      const bx = data[i * 4],
        by = data[i * 4 + 1];
      let best = 0,
        bestD = Infinity;
      for (let j = 0; j < shapePts.length; j++) {
        const dx = shapePts[j][0] / 250 - 1 - bx;
        const dy = -(shapePts[j][1] / 250 - 1) - by;
        const d = dx * dx + dy * dy;
        if (d < bestD) {
          bestD = d;
          best = j;
        }
      }
      assign[i * 4 + 0] = shapePts[best][0] / 250 - 1;
      assign[i * 4 + 1] = -(shapePts[best][1] / 250 - 1);
    }
    if (!this.nearTex) {
      this.nearTex = new THREE.DataTexture(
        assign,
        SIZE,
        SIZE,
        THREE.RGBAFormat,
        THREE.FloatType,
      );
      this.nearTex.needsUpdate = true;
      this.simMat.uniforms.uPosNearest.value = this.nearTex;
    } else {
      (this.nearTex.image.data as unknown as Float32Array).set(assign);
      this.nearTex.needsUpdate = true;
    }
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.clock.start();
    this.rafId = requestAnimationFrame(this.loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    this.clock.stop();
  }

  resize() {
    const w = this.container.offsetWidth;
    const h = this.container.offsetHeight;
    if (!w || !h) return;
    this.renderer.setSize(w * 0.75, h * 0.75, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderMat.uniforms.uRez.value.set(
      this.renderer.domElement.width,
      this.renderer.domElement.height,
    );
    this.renderMat.uniforms.uParticleScale.value = this.particleScale();
    this.renderMat.uniforms.uPixelRatio.value =
      this.renderer.getPixelRatio();
  }

  /** Debug probe: stats from the live state texture. */
  probe() {
    const buf = new Float32Array(SIZE * SIZE * 4);
    this.renderer.readRenderTargetPixels(
      this.rtA,
      0,
      0,
      SIZE,
      SIZE,
      buf,
    );
    let sumScale = 0,
      maxScale = 0,
      sumDisp = 0,
      n = this.count;
    const ref = this.refTex.image.data as unknown as Float32Array;
    for (let i = 0; i < n; i++) {
      const s = buf[i * 4 + 2];
      sumScale += s;
      if (s > maxScale) maxScale = s;
      const dx = buf[i * 4] - ref[i * 4];
      const dy = buf[i * 4 + 1] - ref[i * 4 + 1];
      sumDisp += Math.sqrt(dx * dx + dy * dy);
    }
    return {
      meanScale: sumScale / n,
      maxScale,
      meanDisp: sumDisp / n,
      ring: { x: this.ringPos.x, y: this.ringPos.y },
      goal: { x: this.cursorGoal.x, y: this.cursorGoal.y },
      hover: this.hoverProgress,
      nearSample: this.nearTex
        ? Array.from(
            (
              this.nearTex.image.data as unknown as Float32Array
            ).slice(0, 24),
          )
        : null,
      refSample: Array.from(
        (this.refTex.image.data as unknown as Float32Array).slice(0, 24),
      ),
    };
  }

  dispose() {
    this.stop();
    this.points.geometry.dispose();
    this.simMat.dispose();
    this.renderMat.dispose();
    this.rtA.dispose();
    this.rtB.dispose();
    this.posTex.dispose();
    this.refTex.dispose();
    this.nearTex?.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  /* ---------- loop ---------- */

  private loop() {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.loop);
    // adaptive frame-skip: run the GPGPU sim at a reduced rAF rate. Halves
    // (or quarters) GPU/CPU cost — decisive under software GL (Lighthouse
    // throttling) and visually lossless for a background field. Same trick
    // as the original's skipFrame.
    this.frameNo++;
    if (this.frameNo % this.skip !== 0) return;
    const frameStart = performance.now();
    const t = this.clock.getElapsedTime();
    const dt = t - this.lastT;
    this.lastT = t;
    this.time += dt;

    // anchor: lazy follow + idle self-drift
    const nx =
      (vnoise(this.time * 0.66 + 94.234) - 0.5) * 2 * (this.hasPointer ? 0.1 : 0.2);
    const ny =
      (vnoise(this.time * 0.75 + 21.028) - 0.5) * 2 * (this.hasPointer ? 0.1 : 0.1);
    if (this.hasPointer) {
      // fresh target each frame: pointer + bounded noise wobble (no accumulation)
      this.cursorGoal.set(
        this.pointerPos.x + nx * 0.5,
        this.pointerPos.y + ny * 0.5,
      );
    } else {
      this.cursorGoal.set(nx * 1.2, ny * 0.6);
    }
    const rate = this.hasPointer ? 0.02 : 0.01;
    this.ringPos.x += (this.cursorGoal.x - this.ringPos.x) * rate;
    this.ringPos.y += (this.cursorGoal.y - this.ringPos.y) * rate;

    // hover tween (replaces GSAP)
    this.hoverProgress +=
      (this.hoverGoal - this.hoverProgress) * 0.08;
    if (Math.abs(this.hoverGoal - this.hoverProgress) < 0.001)
      this.hoverProgress = this.hoverGoal;

    // breathing radius
    if (this.mode === "ring") {
      this.simMat.uniforms.uRingRadius.value =
        0.175 + Math.sin(this.time) * 0.03 + Math.cos(this.time * 3) * 0.02;
    } else {
      this.simMat.uniforms.uIsHovering.value = this.hoverProgress;
    }

    // sim pass: read A -> write B
    this.simMat.uniforms.uPosition.value = this.everRendered
      ? this.rtA.texture
      : this.refTex;
    this.simMat.uniforms.uTime.value = t;
    this.renderer.setRenderTarget(this.rtB);
    this.renderer.render(this.simScene, this.simCam);
    this.renderer.setRenderTarget(null);

    // draw pass reads B
    this.renderMat.uniforms.uPosition.value = this.everRendered
      ? this.rtB.texture
      : this.refTex;
    this.renderMat.uniforms.uTime.value = t;
    this.renderer.autoClear = false;
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);

    // ping-pong
    const tmp = this.rtA;
    this.rtA = this.rtB;
    this.rtB = tmp;
    this.everRendered = true;

    // adapt skip to measured frame cost (24ms budget ≈ sustainable 40fps)
    const cost = performance.now() - frameStart;
    if (cost > 24) this.skip = Math.min(this.skip + 1, 5);
    else if (cost < 12) this.skip = Math.max(this.skip - 1, 2);
  }
}
