import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { once } from "node:events";

const url = process.argv[2] || "http://127.0.0.1:5173/";
const target = new URL(url);
const isLocal = ["127.0.0.1", "localhost", "::1"].includes(target.hostname);

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function isReachable(origin) {
  try {
    const response = await fetch(origin, {
      signal: AbortSignal.timeout(1_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function startDevServer() {
  const host = target.hostname === "localhost" ? "127.0.0.1" : target.hostname;
  const port = target.port || "5173";
  const viteBin = "node_modules/vite/bin/vite.js";
  const output = [];
  const server = spawn(
    process.execPath,
    [viteBin, "--host", host, "--port", port, "--strictPort"],
    {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  const collect = (chunk) => {
    output.push(chunk.toString());
    if (output.length > 40) output.shift();
  };
  server.stdout.on("data", collect);
  server.stderr.on("data", collect);

  console.error(`[measure:startup] Starting Vite on ${target.origin}...`);
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(
        `Vite exited before it became ready.\n${output.join("")}`,
      );
    }
    if (await isReachable(target.origin)) return server;
    await wait(100);
  }

  server.kill("SIGTERM");
  throw new Error(
    `Timed out waiting for Vite at ${target.origin}.\n${output.join("")}`,
  );
}

async function stopDevServer(server) {
  if (!server || server.exitCode !== null) return;
  server.kill("SIGTERM");
  await Promise.race([once(server, "exit"), wait(2_000)]);
  if (server.exitCode === null) server.kill("SIGKILL");
}

let devServer = null;
let browser = null;

try {
  if (isLocal && !(await isReachable(target.origin))) {
    devServer = await startDevServer();
  } else if (isLocal) {
    console.error(
      `[measure:startup] Reusing server at ${target.origin}.`,
    );
  }

  browser = await chromium.launch({
    args: [
      "--no-sandbox",
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      "--ignore-gpu-blocklist",
    ],
  });

  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  if (new URL(url).searchParams.get("mode") === "assets") {
    const loading = page.getByText("Loading assets...");
    await loading.waitFor({ state: "visible", timeout: 30_000 });
    await loading.waitFor({ state: "hidden", timeout: 120_000 });
  } else {
    await page
      .getByRole("button", { name: /click to start/i })
      .waitFor({ state: "visible", timeout: 120_000 });
  }

  const metrics = await page.evaluate(() => {
    const worldAssetPrefixes = [
      "/assets/models/",
      "/assets/textures/",
      "/assets/sounds/",
      "/assets/music/",
    ];
    const resources = performance
      .getEntriesByType("resource")
      .filter((entry) =>
        worldAssetPrefixes.some((prefix) =>
          new URL(entry.name).pathname.startsWith(prefix),
        ),
      );
    const bytes = (field) =>
      resources.reduce((total, entry) => total + (entry[field] || 0), 0);
    const largest = resources
      .map((entry) => ({
        path: new URL(entry.name).pathname.replace(/^\/assets\//, ""),
        bytes: entry.encodedBodySize || entry.transferSize || 0,
      }))
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 10);
    return {
      assetRequests: resources.length,
      transferBytes: bytes("transferSize"),
      encodedBodyBytes: bytes("encodedBodySize"),
      decodedBodyBytes: bytes("decodedBodySize"),
      largest,
    };
  });

  const mb = (bytes) => Math.round((bytes / 1024 / 1024) * 10) / 10;
  console.log(
    JSON.stringify(
      {
        url,
        assetRequests: metrics.assetRequests,
        transferMB: mb(metrics.transferBytes),
        encodedBodyMB: mb(metrics.encodedBodyBytes),
        decodedBodyMB: mb(metrics.decodedBodyBytes),
        largest: metrics.largest.map((entry) => ({
          path: entry.path,
          mb: mb(entry.bytes),
        })),
      },
      null,
      2,
    ),
  );
} finally {
  await browser?.close();
  await stopDevServer(devServer);
}
