import { rm } from "node:fs/promises";

// `.next` is generated output only. Cleaning it before a release build avoids
// stale route-group segment directories after an interrupted Windows build.
await rm(new URL("../.next", import.meta.url), { recursive: true, force: true });
