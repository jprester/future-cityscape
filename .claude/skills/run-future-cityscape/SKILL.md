---
name: run-future-cityscape
description: Run, launch, start, build, or screenshot the Future Cityscape app — a Vite + React Three Fiber WebGL cyberpunk city. Drives a headless Chromium via Playwright to render the scene and capture a screenshot (e.g. to verify the rooftop view, lighting, or a layout change).
---

# Run Future Cityscape

Future Cityscape is a single-page **Vite + React Three Fiber (WebGL)** app. There
is no server API and no CLI — "running it" means serving the Vite dev build and
rendering it in a browser. An agent in a headless shell can't open a window, so
the harness is a **Playwright driver** (`driver.mjs`, in this skill dir) that
launches headless Chromium (WebGL via SwiftShader), clicks the start gate, and
screenshots the rendered `<canvas>`.

All paths below are relative to the **project root** (the dir with `package.json`).

## Prerequisites

- Node (v22 used here) and project deps installed: `npm install`.
- **Playwright + Chromium** (already a devDependency here; install the browser if missing):
  ```bash
  npx playwright install chromium
  ```

## Run (agent path) — screenshot the app

Two steps: start the dev server, then run the driver against it.

```bash
# 1. Start the Vite dev server in the background (serves on :5173).
npm run dev > /tmp/fc-dev.log 2>&1 &
# Wait until it answers (macOS has no `timeout`; just poll curl).
until curl -sf -o /dev/null http://localhost:5173/; do sleep 1; done

# 2. Drive headless Chromium → screenshot the rendered canvas.
node .claude/skills/run-future-cityscape/driver.mjs
```

The driver navigates to `http://localhost:5173`, waits for assets to load (the
gate button flips from "Loading…" to **"Click to start"**), clicks it (which runs
`game.onEnterClick()` → initializes the scene and spawns the player), waits ~5 s
for the scene to populate, hides the start/Leva overlays, and writes:

```
.claude/skills/run-future-cityscape/screenshot.png   (1600x900 PNG)
```

**Look at the screenshot** — a black frame means the WebGL context failed to
render (see Troubleshooting). Override URL / output path with args:
`node .claude/skills/run-future-cityscape/driver.mjs http://localhost:5173 /tmp/out.png`.

Stop the dev server when done:
```bash
pkill -f "node.*vite" || pkill -f "npm run dev"
```

## Run (human path)

`npm run dev`, open `http://localhost:5173`, click **Click to start**, then use
mouse-look + WASD (Shift to run). Useless in a headless shell — there's no window.

## Build / typecheck

```bash
npm run typecheck      # tsc --noEmit (also checks the .js classes)
npm run build          # vite build → dist/  (~900ms)
```

## Gotchas

- **Screenshotting the animating canvas hangs.** Both `page.screenshot()` and
  `locator.screenshot()` wait for a "stable" frame that never comes (the render
  loop runs every frame). The driver captures via **CDP `Page.captureScreenshot`**
  instead, which grabs the current compositor frame immediately. Don't switch it
  back to the Playwright screenshot API.
- **Can't read the canvas with `toDataURL()`.** R3F doesn't set
  `preserveDrawingBuffer`, so the WebGL buffer reads back blank. The compositor
  screenshot (above) is the only reliable capture.
- **Pointer lock rejects in headless** (`The root document of this element is not
  valid for pointer lock`). Harmless — `onEnterClick()` already initialized the
  game, and the scene renders/animates regardless of lock state. But the
  start/settings overlay (`showBlocker`) never hides, so the driver hides all
  fixed, `z-index ≥ 50` layers before capturing.
- **WebGL needs SwiftShader flags** in headless: the driver launches with
  `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader
  --ignore-gpu-blocklist`. Without them the context may not create.
- **macOS has no `timeout`** — poll with a `curl` loop instead (shown above).
- **`assets/models/ny-office-building.glb` 404s** (`SyntaxError: Unexpected token
  '<' … is not valid JSON` from GLTFLoader). Pre-existing missing asset, not
  fatal — the app loads everything else and renders. Ignore it.
- **Assets load fast here but can take longer** on a cold cache; the driver waits
  up to 120 s for the "Click to start" button.

## Troubleshooting

- **`EADDRINUSE` on :5173** — a previous dev server is still up:
  `pkill -f "node.*vite"` then relaunch.
- **Black / empty screenshot** — WebGL context failed. Re-run and read the
  driver's `console error(s)` output; confirm the SwiftShader launch flags are
  present. Increasing the post-start `waitForTimeout` can help on slow machines.
- **Driver times out on "Click to start"** — assets failed to load. Check
  `/tmp/fc-dev.log` and the browser console errors the driver prints.
