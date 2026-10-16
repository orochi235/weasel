import { describe, expect, it } from 'vitest';
import { renderReadme, type Traits } from './readme-packages.mjs';

const none: Traits = { react: 'none', dom: false, webgl2: false, webaudio: false, standalone: false };
const readme = (rows: string) =>
  `# x\n\n<!-- packages:start -->\n| Package | What it is |\n|---|---|\n${rows}\n<!-- packages:end -->\n\ntail\n`;
const rowOf = (out: string, name: string) => out.split('\n').find((l) => l.startsWith(`| \`${name}\``));

describe('renderReadme', () => {
  it('marks each package from its traits and keeps its description', () => {
    const out = renderReadme(
      readme('| `geom` | pure geometry |\n| `core` | the scene graph |'),
      new Map([
        ['geom', { ...none, standalone: true }],
        ['core', { ...none, react: 'needs', dom: true, webgl2: true }],
      ]),
    );
    expect(rowOf(out, 'geom')).toMatch(/^\| `geom` \| <img src="docs\/badges\/standalone\.svg"[^|]*\| pure geometry \|$/);
    const core = rowOf(out, 'core')!;
    expect([...core.matchAll(/badges\/([a-z0-9-]+)\.svg/g)].map((m) => m[1])).toEqual(['react', 'dom', 'webgl2']);
    expect(out.endsWith('<!-- packages:end -->\n\ntail\n')).toBe(true);
  });

  it('is stable when run on its own output', () => {
    const traits = new Map([['geom', { ...none, react: 'optional' as const }]]);
    const once = renderReadme(readme('| `geom` | pure geometry |'), traits);
    expect(renderReadme(once, traits)).toBe(once);
  });

  it('drops a row whose package is gone, and refuses a package with no row', () => {
    const out = renderReadme(readme('| `geom` | g |\n| `gone` | old |'), new Map([['geom', none]]));
    expect(rowOf(out, 'gone')).toBeUndefined();
    expect(() => renderReadme(readme('| `geom` | g |'), new Map([['geom', none], ['text', none]]))).toThrow(/no row for text/);
  });
});
