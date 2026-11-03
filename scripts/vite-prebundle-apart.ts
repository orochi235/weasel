/**
 * Re-bundles a dev config's dependencies into its optimizer cache and exits, for `restartLeavingNothing`.
 *
 *   node scripts/vite-prebundle-apart.ts <config file> <mode>
 */
import { optimizeDeps, resolveConfig } from 'vite';

const [configFile, mode] = process.argv.slice(2);
// `error` also hides the deprecation warning `optimizeDeps` prints; the log level is not part of the cache's hash.
const config = await resolveConfig({ configFile, mode, logLevel: 'error' }, 'serve');
await optimizeDeps(config, true);
process.exit(0);
