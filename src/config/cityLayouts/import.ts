import type { FiniteCityLayout } from "./types";

/**
 * Load a FiniteCityLayout from a URL.
 * For files in public/layouts/, pass a path like "/layouts/my_city.json".
 * Falls through with a descriptive error if the fetch fails or the JSON is malformed.
 */
export async function loadLayoutFromURL(url: string): Promise<FiniteCityLayout> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load layout from "${url}" (HTTP ${response.status})`);
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error(`Layout file "${url}" is not valid JSON`);
  }

  if (
    typeof data !== "object" ||
    data === null ||
    !("buildings" in data) ||
    !("groundTiles" in data) ||
    !("bounds" in data) ||
    !("spawn" in data)
  ) {
    throw new Error(
      `Layout file "${url}" is missing required fields (buildings, groundTiles, bounds, spawn)`,
    );
  }

  return data as FiniteCityLayout;
}
