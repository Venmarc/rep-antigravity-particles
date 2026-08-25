import { chromium } from "playwright";

const base = "http://127.0.0.1:4173";
const browser = await chromium.launch({
  executablePath: "/opt/brave.com/brave/brave",
  args: ["--incognito", "--disable-extensions"],
});
const ctx = await browser.newContext({
  viewport: { width: 1366, height: 768 },
});
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

// 1. OX: cursor to a known spot, verify void + rim
await page.goto(base + "/", { waitUntil: "networkidle" });
await page.waitForTimeout(12000);
await page.mouse.move(400, 384);
await page.waitForTimeout(4000);
await page.screenshot({ path: "screenshots/build-check/ox-void-check.png" });

// 2. Playground: clear input -> no {} repopulation, shape persists
await page.goto(base + "/playground", { waitUntil: "networkidle" });
await page.waitForTimeout(12000);
await page.click("#glyph-input");
await page.fill("#glyph-input", "");
await page.waitForTimeout(400);
const clearedVal = await page.inputValue("#glyph-input");
console.log("cleared input value:", JSON.stringify(clearedVal));

// blur -> shape should persist
await page.click("body", { position: { x: 100, y: 700 } });
await page.waitForTimeout(4000);
const blurredGlyph = await page.evaluate(
  () => document.querySelector("[data-particle-swarm='morph']"),
);
console.log("canvas present after blur:", !!blurredGlyph);
await page.screenshot({ path: "screenshots/build-check/pg-blur-hold.png" });

// 3. theme toggle
await page.click("button[aria-label*='theme']");
await page.waitForTimeout(12000);
await page.screenshot({ path: "screenshots/build-check/pg-light.png" });

// 4. drag panel
const panel = page.locator("[data-draggable-panel]");
const box = await panel.boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + 20);
await page.mouse.down();
await page.mouse.move(box.x + box.width / 2 - 350, box.y + 20 + 200, { steps: 12 });
await page.mouse.up();
await page.waitForTimeout(400);
const box2 = await panel.boundingBox();
console.log("panel moved dx:", Math.round(box2.x - box.x), "dy:", Math.round(box2.y - box.y));
await page.screenshot({ path: "screenshots/build-check/pg-dragged.png" });

console.log("console errors:", errors.length ? errors : "none");
await browser.close();
