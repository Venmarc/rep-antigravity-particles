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
  const buf = new Float32Array(256 * 256 * 4);
  s.renderer.readRenderTargetPixels(s.rtA, 0, 0, 256, 256, buf);
  const W = 1366, H = 768;
  const halfH = Math.tan((40 * Math.PI) / 360) * 3.1; // 1.128
  const halfW = halfH * (W / H);
  const MS = 3.5; // ring-mode meshScale default (engine.ts)
  // project mesh-local -> screen px: world = local*MS; ndc = world/half
  const toScreen = (x, y) => [
    ((x * MS) / halfW / 2 + 0.5) * W,
    (0.5 - (y * MS) / halfH / 2) * H,
  ];
  const hi = [];
  for (let i = 0; i < s.count; i++) {
    const sc = buf[i * 4 + 2];
    if (sc > 1) {
      const [sx, sy] = toScreen(buf[i * 4], buf[i * 4 + 1]);
      hi.push([
        Math.round(sx),
        Math.round(sy),
        +sc.toFixed(2),
      ]);
    }
  }
  // scale histogram of all rendered texels
  let buckets = new Array(10).fill(0);
  for (let i = 0; i < s.count; i++) {
    const sc = buf[i * 4 + 2];
    buckets[Math.min(9, Math.floor(sc * 2))]++;
  }
  return { ring: s.ringPos, hiCount: hi.length, hi: hi.slice(0, 400), buckets };
});
console.log("ring:", JSON.stringify(out.ring), "hi:", out.hiCount);
console.log("scale buckets (0-0.2,...,1.8+):", JSON.stringify(out.buckets));
console.log("hi sample:", JSON.stringify(out.hi.slice(0, 40)));
await browser.close();
