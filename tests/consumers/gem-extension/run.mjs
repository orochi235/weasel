// Runs the built scenario in Node under jsdom, as an app's own test would: `npm run build && npm run scenario`.
import { window } from './dom.mjs';

const { runGemScenario } = await import('./dist/scenario.js');
await runGemScenario((line) => console.log(`[gem] ${line}`));
console.log('[gem] scenario passed');
window.close();
