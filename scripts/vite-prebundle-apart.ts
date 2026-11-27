/**
 * Re-bundles a dev config's dependencies into its optimizer cache and exits, for `restartLeavingNothing`.
 *
 *   node scripts/vite-prebundle-apart.ts <config file> <mode>
 */
import { optimizeDeps, resolveConfig } from 'vite';
import { cli } from './lib/help.mjs';

const { positionals } = cli(import.meta.url, {
  summary: "Re-bundles a dev config's dependencies into its optimizer cache and exits, for restartLeavingNothing.",
  positionals: '<config-file> <mode>',
});
const [configFile, mode] = positionals;
// `error` also hides the deprecation warning `optimizeDeps` prints; the log level is not part of the cache's hash.
const config = await resolveConfig({ configFile, mode, logLevel: 'error' }, 'serve');
await optimizeDeps(config, true);
process.exit(0);
