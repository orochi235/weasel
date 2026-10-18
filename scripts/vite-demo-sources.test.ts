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

  it('leaves out a file that marks itself site chrome', () => {
    write('demos/Stage.tsx', '/** @site-chrome */\nexport const Stage = () => null;');
    write('demos/plain.ts', '// mentions @site-chrome mid-sentence, which is no marker\nexport const p = 1;');
    write('demos/E.tsx', [
      "import { Stage } from './Stage';",
      "import { p } from './plain';",
      'export default () => <Stage />;',
    ].join('\n'));
    expect(tabsFor(root, 'demos/E.tsx')).toEqual([
      { path: 'demos/E.tsx', language: 'tsx' },
      { path: 'demos/plain.ts', language: 'ts' },
    ]);
  });
});
