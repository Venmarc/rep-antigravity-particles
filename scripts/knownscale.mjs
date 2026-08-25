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
const res = await page.evaluate(() => {
  const s = window.__swarm;
  const THREE = s.constructor; // not three itself; build texture via s.posTex clone
  const tex = s.refTex.clone();
  const d = tex.image.data;
  for (let i = 0; i < 256 * 256; i++) {
    d[i * 4 + 2] = 2.0; // scale
    d[i * 4 + 3] = 0.0; // velocity
  }
  tex.needsUpdate = true;
  s.stop();
  s.renderMat.uniforms.uPosition.value = tex;
  s.renderer.autoClear = false;
  s.renderer.clear();
  s.renderer.render(s.scene, s.camera);
  return { uParticleScale: s.renderMat.uniforms.uParticleScale.value };
});
console.log(JSON.stringify(res));
await page.waitForTimeout(300);
await page.screenshot({ path: "/tmp/opencode/knownscale.png" });
await browser.close();
