import { expect } from 'vitest';

// A property file's ordinary run replays one seed, so its tally guards pass or fail alike on every run; a deep run
// (`WEASEL_PBT_RUNS`) draws fresh seeds to explore. Loaded only for property files, so the rest pay nothing.
if (/\.pbt\.test\.tsx?$/.test(expect.getState().testPath ?? '') && !(Number(process.env.WEASEL_PBT_RUNS) > 0)) {
  const { default: fc } = await import('fast-check');
  fc.configureGlobal({ seed: 0x5eed });
}
