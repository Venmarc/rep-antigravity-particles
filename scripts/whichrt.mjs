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
const out = await page.evaluate(() => {
  const s = window.__swarm;
  const read = (rt) => {
    const buf = new Float32Array(256 * 256 * 4);
    s.renderer.readRenderTargetPixels(rt, 0, 0, 256, 256, buf);
    let sum = 0, max = 0, hi = 0;
    for (let i = 0; i < 65536; i++) {
      const sc = buf[i * 4 + 2];
      sum += sc;
      if (sc > max) max = sc;
      if (sc > 1) hi++;
    }
    return { mean: sum / 65536, max, hi };
  };
  const rm = s.renderMat.uniforms.uPosition.value;
  const sm = s.simMat.uniforms.uPosition.value;
  return {
    renderBoundIsRtA: rm === s.rtA.texture,
    renderBoundIsRtB: rm === s.rtB.texture,
    simBoundIsRtA: sm === s.rtA.texture,
    rtAstats: read(s.rtA),
    rtBstats: read(s.rtB),
    count: s.count,
  };
});
console.log(JSON.stringify(out, null, 1));
await browser.close();
