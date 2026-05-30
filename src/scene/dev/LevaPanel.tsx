import { Leva } from "leva";

/**
 * The Leva control panel (HTML, rendered outside the Canvas). Dev-only; the
 * caller gates this behind import.meta.env.DEV so Leva is excluded from
 * production builds.
 */
export default function LevaPanel() {
  return <Leva collapsed />;
}
