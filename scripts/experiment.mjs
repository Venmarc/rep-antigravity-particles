import { chromium } from "playwright";

const brave = "/opt/brave.com/brave/brave";
const browser = await chromium.launch({
  executablePath: brave,
  headless: true,
  args: ["--incognito", "--disable-extensions"],
});
const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
const page = await ctx.newPage();
await page.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.mouse.move(683, 384);
await page.waitForTimeout(5000);

// experiment 1: crank particle size x8
await page.evaluate(() => {
  const s = window.__swarm;
  s.renderMat.uniforms.uParticleScale.value *= 8;
});
await page.waitForTimeout(500);
await page.screenshot({ path: "/tmp/opencode/exp-bigpoints.png" });
await page.evaluate(() => {
  const s = window.__swarm;
  s.renderMat.uniforms.uParticleScale.value /= 8;
});

// experiment 2: force alpha path — set uAlpha 1 (already) but disable velocity multiply
await page.evaluate(() => {
  const s = window.__swarm;
  s.renderMat.uniforms.uColorScheme.value = 0; // light scheme = no velocity multiply
});
await page.waitForTimeout(300);
await page.screenshot({ path: "/tmp/opencode/exp-novelocity.png" });
await page.evaluate(() => {
  const s = window.__swarm;
  s.renderMat.uniforms.uColorScheme.value = 1;
});

// experiment 3: read center pixels of the framebuffer directly
const px = await page.evaluate(() => {
  const s = window.__swarm;
  const gl = s.renderer.getContext();
  const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
  const buf = new Uint8Array(w * h * 4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
  // sample a horizontal strip through the ring radius above center
  const cx = Math.floor(w / 2), cy = Math.floor(h / 2);
  const out = [];
  for (let dy = -320; dy <= 320; dy += 40) {
    const x = cx, y = cy + dy;
    const i = (y * w + x) * 4;
    out.push([dy, buf[i], buf[i + 1], buf[i + 2], buf[i + 3]]);
  }
  return out;
});
console.log("center strip (dy,r,g,b,a):", JSON.stringify(px));
await browser.close();
