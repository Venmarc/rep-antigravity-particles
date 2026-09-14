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

// Formed = the engine exists AND the morph has settled. Fixed-duration waits
// lied: a stale window.__swarm after a client-side route change plus the
// software-GL start delay meant screenshots were taken before the field began.
// `field` picks the engine whose host lives in [data-hour-field=FIELD] — the
// day page runs two engines at once and window.__swarm is the *latest*, which
// after advancing can be the hidden one. Never throws.
async function waitFormed(
  page,
  { timeout = 45000, requireHover = true, field = null } = {},
) {
  let stage = "engine";
  try {
    await page.waitForFunction(
      (f) => {
        const w = window;
        if (f && w.__swarms) {
          const e = w.__swarms.find(
            (x) => x.host.closest("[data-hour-field]")?.dataset.hourField === f,
          );
          if (e) return typeof e.swarm.probe === "function";
        }
        return !!w.__swarm && typeof w.__swarm.probe === "function";
      },
      field,
      { timeout },
    );
    if (requireHover) {
      stage = "hover";
      await page.waitForFunction(
        (f) => {
          const w = window;
          const s =
            f && w.__swarms
              ? w.__swarms.find(
                  (x) =>
                    x.host.closest("[data-hour-field]")?.dataset.hourField === f,
                )?.swarm
              : w.__swarm;
          return s && s.probe().hover > 0.98;
        },
        field,
        { timeout, polling: 100 },
      );
    }
    stage = "settle";
    await page.waitForFunction(
      (f) => {
        const w = window;
        const s =
          f && w.__swarms
            ? w.__swarms.find(
                (x) => x.host.closest("[data-hour-field]")?.dataset.hourField === f,
              )?.swarm
            : w.__swarm;
        if (!s) return false;
        const d = s.probe().meanDisp;
        const prev = w.__lastDisp;
        w.__lastDisp = d;
        return typeof prev === "number" && Math.abs(prev - d) < 0.001;
      },
      field,
      { timeout, polling: 300 },
    );
    await page.waitForTimeout(300);
    return true;
  } catch {
    const st = await page
      .evaluate(
        (f) => {
          const w = window;
          const s = f
            ? w.__swarms?.find(
                (x) => x.host.closest("[data-hour-field]")?.dataset.hourField === f,
              )?.swarm
            : w.__swarm;
          const p = s?.probe?.();
          return p ? `hover=${p.hover.toFixed(2)} meanDisp=${p.meanDisp.toFixed(4)}` : "no swarm";
        },
        field,
      )
      .catch(() => "probe failed");
    console.log(`waitFormed: DID NOT SETTLE (stage=${stage}, field=${field}, ${st})`);
    return false;
  }
}

// the smoother owns scrolling (normalizeScroll reverts programmatic native
// scroll — the same reason Playwright auto-scroll loops), so drive the
// viewport through it before any click/hover that may sit off-screen.
// scrollTo(el, false) jumps the scroll position instantly, but the content
// transform keeps easing toward it for ~1s; clicking mid-ease retargets the
// click to a common ancestor (verified: 12:00 row slid under the cursor).
// So: scroll, then poll until the transform is stable twice in a row.
async function settleSmoother(page) {
  await page.evaluate(() => {
    window.__settle = { last: null };
  });
  await page.waitForFunction(
    () => {
      const c = document.querySelector("[data-smooth-content]");
      if (!c || !window.__settle) return true;
      const m = getComputedStyle(c).transform + ":" + window.scrollY;
      if (m === window.__settle.last) return true;
      window.__settle.last = m;
      return false;
    },
    null,
    { timeout: 4000, polling: 150 },
  );
  await page.waitForTimeout(200);
}
async function smoothTop(page) {
  await page.evaluate(() => {
    if (window.__smoother) window.__smoother.scrollTop(0, false);
    else window.scrollTo(0, 0);
  });
  await settleSmoother(page);
}
async function smoothTo(page, sel) {
  // the smoother is deferred past the load window (software GL: 10s), so fall
  // back to native scrolling until it exists
  await page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return;
    if (window.__smoother) window.__smoother.scrollTo(el, false);
    else el.scrollIntoView({ block: "start" });
  }, sel);
  await settleSmoother(page);
}

// Playwright's locator.hover() is flaky against the smooth-scroller: it uses
// scrollIntoViewIfNeeded (which normalizeScroll fights) and can leave the
// pointer off-target, so the field never reports hover. Drive it by hand:
// settle, leave, then move onto the box centre and verify hover actually rose.
async function hoverField(page, sel, attempts = 3) {
  const field = sel.match(/data-hour-field='([^']+)'/)?.[1] ?? null;
  await smoothTo(page, sel);
  for (let i = 0; i < attempts; i++) {
    await page.mouse.move(5, 5);
    await page.waitForTimeout(150);
    const pt = await page.evaluate((s) => {
      const el = document.querySelector(s);
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }, sel);
    await page.mouse.move(pt.x, pt.y, { steps: 4 });
    try {
      await page.waitForFunction(
        (f) => {
          const w = window;
          const s =
            f && w.__swarms
              ? w.__swarms.find(
                  (x) => x.host.closest("[data-hour-field]")?.dataset.hourField === f,
                )?.swarm
              : w.__swarm;
          return s && s.probe().hover > 0.5;
        },
        field,
        { timeout: 6000, polling: 100 },
      );
      return true;
    } catch {
      /* retry */
    }
  }
  console.log("hoverField: could not raise hover on", sel);
  return false;
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

// 2. Signal light theme (capsule detach needs the smoother, not native scroll)
await page.goto("http://127.0.0.1:4173/signal", { waitUntil: "networkidle" });
await waitSwarm(page);
await page.mouse.move(683, 340);
await page.waitForTimeout(1800);
await page.screenshot({ path: `${outDir}/signal-hero.png` });
await page.evaluate(() => window.__smoother?.scrollTop(400, false));
await page.waitForTimeout(900);
await page.screenshot({ path: `${outDir}/signal-scrolled-capsule.png` });

// 3. Playground morph
await page.goto("http://127.0.0.1:4173/playground", { waitUntil: "networkidle" });
await waitSwarm(page);
await page.screenshot({ path: `${outDir}/pg-rest.png` });
await page.click("#glyph-input");
await page.fill("#glyph-input", "%");
// playground morph is cursor-driven, so hover is not necessarily 1 here —
// use the proven fixed warm-up instead of waitFormed's hover gate
await page.waitForTimeout(7000);
await page.screenshot({ path: `${outDir}/pg-percent.png` });
await page.fill("#glyph-input", "🧑");
await page.waitForTimeout(7000);
await page.screenshot({ path: `${outDir}/pg-emoji.png` });

// 4. Day — forward-only hours, the two CTA morph fields, theme, note drag
await page.goto("http://127.0.0.1:4173/day", { waitUntil: "networkidle" });
await waitSwarm(page);
await page.screenshot({ path: `${outDir}/day-0900-idle.png` });
// hover the open photograph -> the analyst's % forms
await hoverField(page, "[data-hour-field='09:00']");
await waitFormed(page, { field: "09:00" });
await page.screenshot({ path: `${outDir}/day-0900-percent-formed.png` });
// leave -> the field relaxes back to rest
await page.mouse.move(10, 10);
await page.waitForTimeout(2500);
await page.screenshot({ path: `${outDir}/day-0900-relaxed.png` });
// forward-only: 06:00 is passed (disabled), 15:00 opens the crew field
const passedDisabled = await page.$eval(
  "[data-hour='06:00'] button",
  (b) => b.disabled,
);
console.log("06:00 passed and disabled:", passedDisabled);
await smoothTo(page, "[data-hour='15:00'] button");
await page.click("[data-hour='15:00'] button");
await page.waitForTimeout(1500);
await hoverField(page, "[data-hour-field='15:00']");
await waitFormed(page, { field: "15:00" });
await page.screenshot({ path: `${outDir}/day-1500-crew-formed.png` });
// 09:00 must now be collapsed (its wrapper carries [hidden])
const collapsed09 = await page.$eval(
  "[data-hour='09:00'] [data-hour-field='09:00']",
  (el) => el.closest("div[hidden]") !== null,
);
console.log("09:00 collapsed after advancing:", collapsed09);
// theme toggle: light variant of the same formed field
await smoothTop(page);
await page.click("[data-theme-toggle]");
await page.waitForTimeout(1200);
await hoverField(page, "[data-hour-field='15:00']");
await waitFormed(page, { field: "15:00" });
await page.screenshot({ path: `${outDir}/day-1500-crew-light.png` });
// back to dark for the remaining checks
await smoothTop(page);
await page.click("[data-theme-toggle]");
await page.waitForTimeout(1200);
await smoothTo(page, "[data-hour-field='15:00']");
// draggable note: pick it up and move it clear of the field
const note = await page.$("[data-hour-field='15:00'] [data-draggable-panel]");
const nbox = await note.boundingBox();
await page.mouse.move(nbox.x + nbox.width / 2, nbox.y + 12);
await page.mouse.down();
await page.mouse.move(nbox.x + 60, nbox.y - 230, { steps: 8 });
await page.mouse.up();
await page.waitForTimeout(600);
await page.screenshot({ path: `${outDir}/day-1500-note-dragged.png` });
const note2 = await page.$("[data-hour-field='15:00'] [data-draggable-panel]");
const nbox2 = await note2.boundingBox();
console.log("note moved:", Math.round(nbox2.y - nbox.y), "px vertically");

// 5. Full-page field views — click the photo card (offset avoids the note)
await page.click("[data-hour-field='15:00']", { position: { x: 60, y: 60 } });
await page.waitForURL("**/day/crew");
await waitFormed(page);
await page.screenshot({ path: `${outDir}/dayfield-crew.png` });
await page.click("[data-back-button]");
await page.waitForURL("**/day");
await page.waitForTimeout(800);
const openAfterBack = await page.$eval(
  "[data-hour='15:00']",
  (el) => el.dataset.hourState,
);
console.log("hour state preserved after back:", openAfterBack);
await page.goto("http://127.0.0.1:4173/day/analyst", { waitUntil: "networkidle" });
await waitFormed(page);
await page.screenshot({ path: `${outDir}/dayfield-analyst.png` });

// 6. Smooth scroll probe — wheel input must settle progressively, not jump.
// The mouse must sit over the smooth content: after section 5 it rests on
// the back button, i.e. over the sticky header that lives OUTSIDE the
// wrapper — wheeling there never reaches GSAP and scrolls natively.
await page.goto("http://127.0.0.1:4173/day", { waitUntil: "networkidle" });
// the smoother initialises on first interaction intent, so raise it first
await page.mouse.move(683, 400);
await page
  .waitForFunction(() => !!window.__smoother, null, { timeout: 20000 })
  .catch(() => {});
const smootherLive = await page.evaluate(() => !!window.__smoother);
console.log("smoother present:", smootherLive);
// let the freshly created smoother prime its first tick, else the first wheel
// is applied without easing (it initialises on interaction by design)
await page.waitForTimeout(700);
const smooth = { before: 0, early: 0, mid: 0, late: 0 };
// normalizeScroll pins window.scrollY to the target instantly; the visible
// scroll is the eased transform on the content — that is what must progress
const readT = () =>
  page.evaluate(() => {
    const c = document.querySelector("[data-smooth-content]");
    return -new DOMMatrixReadOnly(getComputedStyle(c).transform).m42;
  });
smooth.before = await readT();
await page.mouse.wheel(0, 2400);
await page.waitForTimeout(80);
smooth.early = await readT();
await page.waitForTimeout(300);
smooth.mid = await readT();
await page.waitForTimeout(900);
smooth.late = await readT();
console.log(
  "smooth scroll content-transform (before/early/mid/late):",
  Math.round(smooth.before), Math.round(smooth.early), Math.round(smooth.mid), Math.round(smooth.late),
);
console.log(
  "smooth scroll is progressive:",
  smooth.early < smooth.late * 0.9 && smooth.mid > smooth.early && smooth.late >= smooth.mid
    ? "yes"
    : "NO — check gates",
);

console.log("errors:", errors.length ? errors : "none");
await browser.close();
