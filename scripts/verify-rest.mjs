import { chromium } from "playwright";
const browser = await chromium.launch({
  executablePath: "/opt/brave.com/brave/brave",
  args: ["--incognito", "--disable-extensions"],
});
const page = await (await browser.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
await page.goto("http://127.0.0.1:4173/playground", { waitUntil: "networkidle" });
await page.waitForTimeout(13000);
await page.fill("#glyph-input", "K");
await page.waitForTimeout(3500);
await page.screenshot({ path: "screenshots/build-check/pg-clickform.png" });
await page.fill("#glyph-input", "");
await page.waitForTimeout(4000);
await page.screenshot({ path: "screenshots/build-check/pg-cleared-rest.png" });
await browser.close();
console.log("done");
