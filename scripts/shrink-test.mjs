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
await page.mouse.move(683, 384);
await page.waitForTimeout(4000);
await page.evaluate(() => {
  const s = window.__swarm;
  s.renderMat.uniforms.uParticleScale.value = 0.02;
});
await page.waitForTimeout(400);
await page.screenshot({ path: "/tmp/opencode/exp-shrink.png" });
const sceneInfo = await page.evaluate(() => {
  const s = window.__swarm;
  return {
    sceneChildren: s.scene.children.map((c) => ({
      type: c.type,
      visible: c.visible,
      isPoints: !!c.isPoints,
      matType: c.material?.type,
      matVisible: c.material?.visible,
      count: c.count,
    })),
  };
});
console.log(JSON.stringify(sceneInfo, null, 1));
await browser.close();
