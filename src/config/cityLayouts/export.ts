import type { FiniteCityLayout } from "./types";

/**
 * Serialize a FiniteCityLayout to a JSON string.
 * Drop the result in public/layouts/ and load it with ?layout=filename.json
 */
export function exportLayoutToJSON(layout: FiniteCityLayout): string {
  return JSON.stringify(layout, null, 2);
}
