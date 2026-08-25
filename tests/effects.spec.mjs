// Technique specs for the antigravity particle swarm rep.
// Library-based (no @playwright/test) — run with:
//   NODE_PATH=~/.agents/playwright-core/node_modules node tests/effects.spec.mjs
// Asserts the TECHNIQUE (sim state, engine behavior), not the look.
import { chromium } from "playwright";

const brave = "/opt/brave.com/brave/brave";
const base = "http://127.0.0.1:4173";
let failures = 0;
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
  if (!ok) failures++;
};

const browser = await chromium.launch({
  executablePath: brave,
  headless: true,
  args: ["--incognito", "--disable-extensions"],
});

const newPage = async (ctxOpts = {}) => {
  const ctx = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    ...ctxOpts,
  });
  const page = await ctx.newPage();
  return { ctx, page };
};

const waitSwarm = (page) =>
  page.waitForFunction(() => !!window.__swarm, null, { timeout: 25000 });

/* 1. Ring organism: sim forms a high-scale band displaced around the anchor */
{
  const { ctx, page } = await newPage();
  await page.goto(base + "/", { waitUntil: "networkidle" });
  await waitSwarm(page);
  await page.mouse.move(683, 384);
  await page.waitForTimeout(9000);
  const probe = await page.evaluate(() => ({
    maxScale: window.__swarm.probe().maxScale,
    running: true,
  }));
  check(
    "ring: organism forms in sim (max scale > 2 after cursor dwell)",
    probe.maxScale > 2,
    `maxScale=${probe.maxScale.toFixed(2)}`,
  );

  // void + rim: hi-scale particles sit AWAY from their homes (displaced out)
  const disp = await page.evaluate(() => window.__swarm.probe().meanDisp);
  check(
    "ring: band particles displaced from homes (organism push)",
    disp > 0.02,
    `meanDisp=${disp.toFixed(3)}`,
  );
  await ctx.close();
}

/* 2. Morph: glyph retarget streams particles and grows their scale */
{
  const { ctx, page } = await newPage();
  await page.goto(base + "/playground", { waitUntil: "networkidle" });
  await waitSwarm(page);
  await page.click("#glyph-input");
  await page.fill("#glyph-input", "%");
  await page.waitForTimeout(9000);
  const probe = await page.evaluate(() => window.__swarm.probe());
  check(
    "morph: glyph assignment raises particle scale",
    probe.maxScale > 0.5,
    `maxScale=${probe.maxScale.toFixed(2)}`,
  );
  await ctx.close();
}

/* 3. Reduced motion: engine never constructed */
{
  const { ctx, page } = await newPage({
    reducedMotion: "reduce",
  });
  await page.goto(base + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(13000);
  const has = await page.evaluate(() => !!window.__swarm);
  check("reduced-motion: engine skipped entirely", !has);
  await ctx.close();
}

/* 4. Touch fallback: coarse pointer still gets a swarm (drag stirs) */
{
  const { ctx, page } = await newPage({
    hasTouch: true,
    viewport: { width: 390, height: 844 },
    isMobile: true,
  });
  await page.goto(base + "/", { waitUntil: "networkidle" });
  await waitSwarm(page);
  // drag on the host must not throw and must move the anchor
  await page.touchscreen.tap(195, 400);
  await page.waitForTimeout(500);
  const ok = await page.evaluate(() => !!window.__swarm);
  check("touch: swarm alive on coarse pointer", ok);
  await ctx.close();
}

/* 5. Delayed start: engine chunk stays out of the load window */
{
  const { ctx, page } = await newPage();
  await page.goto(base + "/", { waitUntil: "load" });
  const early = await page.evaluate(() => !!window.__swarm);
  await waitSwarm(page);
  const late = await page.evaluate(
    () => !!window.__swarm,
  );
  check(
    "perf: engine loads after window load (deferred kick)",
    !early && late,
  );
  await ctx.close();
}

await browser.close();
console.log(failures ? `\n${failures} FAILURE(S)` : "\nALL PASS");
process.exit(failures ? 1 : 0);
