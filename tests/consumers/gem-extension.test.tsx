/** The public-only extension example in `gem-extension/`, run end to end against the repo's own source. */
import { it } from 'vitest';
import { runGemScenario } from './gem-extension/src/scenario.js';

it('inserts, edits, undoes, saves, loads, and unregisters the gem extension', async () => {
  await runGemScenario();
});
