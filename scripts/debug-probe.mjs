import { chromium } from "playwright";

const brave = "/opt/brave.com/brave/brave";
const browser = await chromium.launch({
  executablePath: brave,
  headless: true,
  args: ["--incognito", "--disable-extensions"],
});
const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

// RING mode probe
await page.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
console.log("ring t0:", JSON.stringify(await page.evaluate(() => window.__swarm.probe())));
await page.mouse.move(683, 384);
await page.waitForTimeout(4000);
console.log("ring t4s:", JSON.stringify(await page.evaluate(() => window.__swarm.probe())));

// MORPH mode probe
await page.goto("http://127.0.0.1:4173/playground", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.click("#glyph-input");
await page.fill("#glyph-input", "%");
await page.waitForTimeout(4000);
console.log("morph t4s:", JSON.stringify(await page.evaluate(() => window.__swarm.probe())));

console.log("errors:", errors.length ? errors : "none");
await browser.close();
