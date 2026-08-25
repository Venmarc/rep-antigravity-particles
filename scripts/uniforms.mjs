import { chromium } from "playwright";
const browser = await chromium.launch({
  executablePath: "/opt/brave.com/brave/brave",
  headless: true,
  args: ["--incognito", "--disable-extensions"],
});
const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
const page = await ctx.newPage();
await page.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.mouse.move(683, 384);
await page.waitForTimeout(3000);
const out = await page.evaluate(() => {
  const s = window.__swarm;
  const u = s.renderMat.uniforms;
  return {
    uParticleScale: u.uParticleScale.value,
    uPixelRatio: u.uPixelRatio.value,
    uAlpha: u.uAlpha.value,
    optsParticlesScale: s.opts.particlesScale,
    optsDensity: s.opts.density,
    mode: s.mode,
    cssW: innerWidth,
    dpr: devicePixelRatio,
  };
});
console.log(JSON.stringify(out, null, 1));
await browser.close();
