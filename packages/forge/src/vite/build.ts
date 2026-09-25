import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { html } from './html.ts';

const DIR = 'node_modules/.forge';
type Source = string | Uint8Array;

const PAGES: Record<string, string> = { index: 'shell-entry.js', frame: 'frame-entry.js' };

/** Writes a build document per forge page under `<root>/node_modules/.forge`, returning them as build inputs. */
export function writePages(root: string): Record<string, string> {
  const dir = join(root, DIR);
  mkdirSync(dir, { recursive: true });
  return Object.fromEntries(
    Object.entries(PAGES).map(([name, entry]) => {
      const file = join(dir, `${name}.html`);
      writeFileSync(file, html(entry, 'build'));
      return [name, file];
    }),
  );
}

/** Vite wrote a relative base's urls from two directories down; the documents now sit at the output root. */
const up = (source: Source) =>
  (typeof source === 'string' ? source : new TextDecoder().decode(source)).replace(/(\s(?:src|href)=")\.\.\/\.\.\//g, '$1./');

/** Replaces the documents vite emitted at their input path with copies at the output root. */
export function hoistPages(
  bundle: Record<string, { type: string; source?: Source }>,
  emit: (file: { type: 'asset'; fileName: string; source: Source }) => void,
): void {
  for (const name of Object.keys(PAGES)) {
    const from = `${DIR}/${name}.html`;
    const asset = bundle[from];
    if (asset?.type !== 'asset' || asset.source === undefined) continue;
    delete bundle[from];
    emit({ type: 'asset', fileName: `${name}.html`, source: up(asset.source) });
  }
}
