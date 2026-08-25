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
await page.waitForTimeout(5000);
await page.evaluate(() => window.__swarm.stop());
await page.screenshot({ path: "/tmp/opencode/frozen.png" });
const out = await page.evaluate(() => {
  const s = window.__swarm;
  const buf = new Float32Array(256 * 256 * 4);
  const hist = (rt) => {
    s.renderer.readRenderTargetPixels(rt, 0, 0, 256, 256, buf);
    const b = new Array(10).fill(0);
    let sum = 0;
    for (let i = 0; i < s.count; i++) {
      const sc = buf[i * 4 + 2];
      sum += sc;
      b[Math.min(9, Math.floor(sc * 2))]++;
    }
    return { mean: sum / s.count, b };
  };
  return {
    rtA: hist(s.rtA),
    rtB: hist(s.rtB),
    uPositionIsRtA:
      s.renderMat.uniforms.uPosition.value === s.rtA.texture,
    uPositionIsRtB:
      s.renderMat.uniforms.uPosition.value === s.rtB.texture,
  };
});
console.log(JSON.stringify(out, null, 1));
await browser.close();
