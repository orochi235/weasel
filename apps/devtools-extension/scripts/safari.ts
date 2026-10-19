// Wraps the Chrome build in a macOS Xcode project for Safari, under the gitignored safari/.
// `--no-open` and `--no-prompt` keep it from opening Xcode or waiting for an answer.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const app = resolve(import.meta.dirname, '..');
const built = resolve(app, 'dist/chrome');
if (!existsSync(resolve(built, 'manifest.json'))) {
  console.error(`devtools-extension: ${built} is not built; run npm run build:devtools-extension first`);
  process.exit(1);
}
execFileSync('xcrun', [
  'safari-web-extension-converter', built,
  '--project-location', resolve(app, 'safari'),
  '--app-name', 'weasel devtools',
  '--bundle-identifier', 'dev.weasel-js.devtools',
  '--macos-only', '--swift', '--copy-resources',
  '--no-open', '--no-prompt', '--force',
], { stdio: 'inherit' });
