// Headless driver for Future Cityscape (Vite + React Three Fiber WebGL app).
//
// Launches Chromium via Playwright, navigates to the running dev server, clicks
// the "Click to start" gate (which initializes the Game and spawns the player on
// the rooftop), lets the scene render, and screenshots the <canvas>.
//
// Usage (dev server must already be running on :5173 — see SKILL.md):
//   node .claude/skills/run-future-cityscape/driver.mjs [url] [outfile]
//
// Defaults: url=http://localhost:5173  outfile=.claude/skills/run-future-cityscape/screenshot.png
//
// WebGL in headless Chromium is forced through SwiftShader (software) so it
// renders deterministically without a GPU.

import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { writeFileSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const url = process.argv[2] || "http://localhost:5173";
const outfile = process.argv[3] || resolve(here, "screenshot.png");

const browser = await chromium.launch({
  args: [
    "--no-sandbox",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
  ],
});

const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });

const consoleErrors = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});
page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));

console.log(`[driver] navigating to ${url}`);
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });

// The start button reads "Loading…" until assets finish (launchReady), then
// "Click to start". Wait for the enabled, ready button — GLB assets are large,
// so allow a generous timeout.
console.log("[driver] waiting for assets to load (Click to start)…");
const startBtn = page.getByRole("button", { name: /click to start/i });
await startBtn.waitFor({ state: "visible", timeout: 120_000 });

// requestPointerLock() rejects in headless (no user-gesture lock); that's fine —
// game.onEnterClick() (init + rooftop spawn) has already run by then. The scene
// renders and animates regardless of pointer-lock state.
console.log("[driver] clicking start…");
await startBtn.click();

// Let the scene initialize, the rooftop spawn apply, and instanced buildings
// populate before capturing.
await page.waitForTimeout(5000);

// In headless, pointer lock never engages, so the start/settings overlay (and
// the dev-only Leva panel) stay on top. Hide those fixed, high-z-index layers
// so the screenshot shows the pure 3D rooftop view rendered on the canvas
// behind them. (We can't read the WebGL canvas via toDataURL — R3F doesn't
// preserve the drawing buffer — and an element screenshot stalls on the
// never-stable animating canvas, so we hide the overlay + full-page capture.)
// React re-renders (e.g. the pointer-lock rejection updating state) can wipe
// the inline display:none and bring the 55%-black blocker back before the
// capture — which used to make screenshots randomly come out dark. Keep
// re-hiding on an interval so any re-rendered overlay is hidden again within
// 100 ms, then give it a beat to settle before capturing.
await page.evaluate(() => {
  const hide = () => {
    for (const el of document.querySelectorAll("body *")) {
      const s = getComputedStyle(el);
      const z = parseInt(s.zIndex, 10);
      if (s.position === "fixed" && Number.isFinite(z) && z >= 50) {
        el.style.display = "none";
      }
    }
  };
  hide();
  setInterval(hide, 100);
});
await page.waitForTimeout(500);

// Report console/page errors before capturing, so a failed WebGL context (etc.)
// is visible even if the screenshot then comes out black.
if (consoleErrors.length) {
  console.log(`[driver] ${consoleErrors.length} console error(s):`);
  for (const e of consoleErrors.slice(0, 15)) console.log("  -", e);
} else {
  console.log("[driver] no console errors");
}

// Playwright's page.screenshot() waits for a stable frame, which never happens
// with a continuously rendering WebGL canvas — it hangs. Capture via the CDP
// command directly, which grabs the current compositor frame immediately.
const client = await page.context().newCDPSession(page);
const { data } = await client.send("Page.captureScreenshot", {
  format: "png",
  captureBeyondViewport: false,
});
writeFileSync(outfile, Buffer.from(data, "base64"));
console.log(`[driver] screenshot saved: ${outfile}`);

await browser.close();
