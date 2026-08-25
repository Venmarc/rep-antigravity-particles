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
await page.screenshot({ path: "/tmp/opencode/corr-center.png" });
const probe = await page.evaluate(() => window.__swarm.probe());
// histogram of scale + displacement buckets via a deeper probe
const detail = await page.evaluate(() => {
  const s = window.__swarm;
  const buf = new Float32Array(256 * 256 * 4);
  s.renderer.readRenderTargetPixels(s.rtA, 0, 0, 256, 256, buf);
  const ref = s.refTex.image.data;
  let hi = 0, mid = 0, far = 0;
  let maxD = 0, sumHiD = 0;
  let hiX = 0, hiY = 0;
  for (let i = 0; i < 65536; i++) {
    const sc = buf[i * 4 + 2];
    const dx = buf[i * 4] - ref[i * 4];
    const dy = buf[i * 4 + 1] - ref[i * 4 + 1];
    const d = Math.sqrt(dx * dx + dy * dy);
    if (sc > 1) {
      hi++;
      sumHiD += d;
      hiX += buf[i * 4];
      hiY += buf[i * 4 + 1];
      if (d > maxD) maxD = d;
    } else if (sc > 0.3) mid++;
    else if (sc > 0.05) far++;
  }
  return {
    hiCount: hi,
    midCount: mid,
    farCount: far,
    meanHiDisp: hi ? sumHiD / hi : 0,
    maxD,
    hiCentroid: hi ? [hiX / hi, hiY / hi] : null,
  };
});
console.log("probe:", JSON.stringify(probe));
console.log("detail:", JSON.stringify(detail));
await browser.close();
