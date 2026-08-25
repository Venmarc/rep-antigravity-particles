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
const out = await page.evaluate(() => {
  const s = window.__swarm;
  const cv = s.renderer.domElement;
  const r = cv.getBoundingClientRect();
  return {
    drawingBuffer: [cv.width, cv.height],
    cssRect: [r.width, r.height],
    container: [cv.parentElement.offsetWidth, cv.parentElement.offsetHeight],
  };
});
console.log(JSON.stringify(out));
await browser.close();
