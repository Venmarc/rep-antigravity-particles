import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const outDir = process.cwd() + "/screenshots/build-check";
const brave = "/opt/brave.com/brave/brave";
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: brave,
  headless: true,
  args: ["--incognito", "--disable-extensions"],
});
const ctx = await browser.newContext({
  viewport: { width: 1366, height: 768 },
});
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push("console: " + m.text());
});

// software-GL delay means the swarm starts up to ~12s after load
async function waitSwarm(page) {
  await page.waitForFunction(
    () => !!window.__swarm && typeof window.__swarm.probe === "function",
    null,
    { timeout: 20000 },
  );
  await page.waitForTimeout(4500);
}

// 1. OX hero at rest + cursor influence
await page.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });
await waitSwarm(page);
await page.screenshot({ path: `${outDir}/ox-rest.png` });
await page.mouse.move(683, 384);
for (let i = 0; i < 30; i++) {
  await page.mouse.move(683 + Math.sin(i / 4) * 200, 384 + Math.cos(i / 5) * 120);
  await page.waitForTimeout(50);
}
await page.waitForTimeout(1500);
await page.screenshot({ path: `${outDir}/ox-cursor.png` });
const oxCanvas = await page.$("[data-particle-swarm='ring']");
console.log("OX canvas present:", !!oxCanvas);

// 2. Signal light theme
await page.goto("http://127.0.0.1:4173/signal", { waitUntil: "networkidle" });
await waitSwarm(page);
await page.mouse.move(683, 340);
await page.waitForTimeout(1800);
await page.screenshot({ path: `${outDir}/signal-hero.png` });
await page.evaluate(() => window.scrollTo(0, 400));
await page.waitForTimeout(900);
await page.screenshot({ path: `${outDir}/signal-scrolled-capsule.png` });

// 3. Playground morph
await page.goto("http://127.0.0.1:4173/playground", { waitUntil: "networkidle" });
await waitSwarm(page);
await page.screenshot({ path: `${outDir}/pg-rest.png` });
await page.click("#glyph-input");
await page.fill("#glyph-input", "%");
await page.waitForTimeout(7000);
await page.screenshot({ path: `${outDir}/pg-percent.png` });
await page.fill("#glyph-input", "🧑");
await page.waitForTimeout(7000);
await page.screenshot({ path: `${outDir}/pg-emoji.png` });

console.log("errors:", errors.length ? errors : "none");
await browser.close();
