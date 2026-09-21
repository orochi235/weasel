/** Writes the panel-stance fallback chains into Properties.module.css. A test fails when they are stale. */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { withPanelStanceCss } from '../src/components/Properties/panelStanceCss';

const file = resolve(dirname(fileURLToPath(import.meta.url)), '../src/components/Properties/Properties.module.css');
writeFileSync(file, withPanelStanceCss(readFileSync(file, 'utf8')));
console.log(`panel stances → ${file}`);
