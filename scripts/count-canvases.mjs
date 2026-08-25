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
  const canvases = [...document.querySelectorAll("canvas")];
  return {
    nCanvases: canvases.length,
    visible: canvases.map((c) => {
      const r = c.getBoundingClientRect();
      const s = c.__swarmRef;
      return {
        w: c.width, h: c.height,
        rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
        inViewport: r.top < innerHeight && r.bottom > 0,
        display: getComputedStyle(c).display,
        visibility: getComputedStyle(c).visibility,
        opacity: getComputedStyle(c).opacity,
        isSwarmDom: window.__swarm && c === window.__swarm.renderer.domElement,
      };
    }),
  };
});
console.log(JSON.stringify(out, null, 1));
await browser.close();
