import { chromium } from "playwright";
import { readFileSync } from "fs";
const pills = readFileSync("/tmp/opencode/pills.txt", "utf8")
  .trim().split("\n").map((l) => l.split(" ").map(Number))
  .filter(([x, y, a]) => a < 1000);
const browser = await chromium.launch({
  executablePath: "/opt/brave.com/brave/brave",
  headless: true, args: ["--incognito", "--disable-extensions"],
});
const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
const page = await ctx.newPage();
await page.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.mouse.move(683, 384);
await page.waitForTimeout(5000);
await page.evaluate(() => window.__swarm.stop());
const out = await page.evaluate((pills) => {
  const s = window.__swarm;
  const buf = new Float32Array(256 * 256 * 4);
  s.renderer.readRenderTargetPixels(s.rtA, 0, 0, 256, 256, buf);
  const W = 1366, H = 996;
  const MS = 3.5;
  const halfH = Math.tan((40 * Math.PI) / 360) * 3.1;
  const halfW = halfH * (W / H);
  const toScreen = (x, y) => [
    ((x * MS) / halfW / 2 + 0.5) * W,
    (0.5 - (y * MS) / halfH / 2) * H,
  ];
  return pills.slice(0, 25).map(([px, py, area]) => {
    let best = null, bestD = Infinity;
    for (let i = 0; i < s.count; i++) {
      const [sx, sy] = toScreen(buf[i * 4], buf[i * 4 + 1]);
      const d = (sx - px) ** 2 + (sy - py) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    }
    return {
      pill: [px, py, area],
      texelScale: +buf[best * 4 + 2].toFixed(2),
      distPx: Math.round(Math.sqrt(bestD)),
    };
  });
}, pills);
console.log(JSON.stringify(out, null, 0));
await browser.close();
