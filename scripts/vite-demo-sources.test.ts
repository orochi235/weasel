import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { tabsFor } from './vite-demo-sources.ts';

const root = mkdtempSync(join(tmpdir(), 'demo-sources-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));

function write(path: string, text: string) {
  mkdirSync(join(root, path, '..'), { recursive: true });
  writeFileSync(join(root, path), text);
}

describe('tabsFor', () => {
  it('lists the demo, then each source file it imports by relative path', () => {
    write('demos/helper.ts', 'export const h = 1;');
    write('demos/D.css', '.d {}');
    write('assets/mark.png', '\u0089PNG');
    write('demos/D.tsx', [
      "import { h } from './helper';",
      "import type { T } from './types';",
      "import './D.css';",
      "import mark from '../assets/mark.png';",
      "const sample = \"import x from './helper-shaped-string';\";",
      'export default () => <img src={mark} alt={sample} />;',
    ].join('\n'));
    expect(tabsFor(root, 'demos/D.tsx')).toEqual([
      { path: 'demos/D.tsx', language: 'tsx' },
      { path: 'demos/helper.ts', language: 'ts' },
      { path: 'demos/D.css', language: 'css' },
    ]);
  });
});
