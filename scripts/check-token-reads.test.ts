import { describe, expect, it } from 'vitest';
import { findAccentFillAsText, findThemeTokenFallbacks, findUndeclaredReads } from './check-token-reads';

const THEME = new Set(['--wzl-fg', '--wzl-surface']);
const HOOKS = new Set(['--wzl-swatch-size']);
const run = (files: { path: string; source: string }[]) => findUndeclaredReads(files, THEME, HOOKS);

describe('findUndeclaredReads', () => {
  it('accepts a read of a theme token', () => {
    expect(run([{ path: 'packages/ui/a.css', source: '.x { color: var(--wzl-fg); }' }])).toEqual([]);
  });

  it('flags a read nothing declares, with its line', () => {
    const out = run([{ path: 'packages/ui/a.css', source: '.x {\n  color: var(--wzl-text);\n}' }]);
    expect(out).toEqual([{ file: 'packages/ui/a.css', line: 2, name: '--wzl-text', reason: 'declared by no theme' }]);
  });

  it('flags an undeclared read even when it carries a fallback', () => {
    expect(run([{ path: 'packages/ui/a.css', source: '.x { color: var(--wzl-text, red); }' }])).toHaveLength(1);
  });

  it('accepts a property the same package declares', () => {
    const files = [
      { path: 'packages/ui/src/a.css', source: '.row { --wzl-prop-gap: 4px; }' },
      { path: 'packages/ui/src/b.css', source: '.cell { gap: var(--wzl-prop-gap); }' },
    ];
    expect(run(files)).toEqual([]);
  });

  it('accepts a property set from a style object in the same package', () => {
    const files = [
      { path: 'packages/ui/src/A.tsx', source: "const s = { '--wzl-fit': `${w}px` };" },
      { path: 'packages/ui/src/a.css', source: '.x { width: var(--wzl-fit, 0px); }' },
    ];
    expect(run(files)).toEqual([]);
  });

  it('does not let another package declare an old name for everyone', () => {
    const files = [
      { path: 'apps/site/demo.css', source: ':root { --wzl-text: #fff; }' },
      { path: 'packages/labkit/src/a.less', source: '.x { color: var(--wzl-text); }' },
    ];
    expect(run(files).map((o) => o.file)).toEqual(['packages/labkit/src/a.less']);
  });

  it('does not count a name inside a comment as a declaration', () => {
    const files = [{ path: 'packages/ui/a.css', source: '/* --wzl-text: gone */\n.x { color: var(--wzl-text); }' }];
    expect(run(files)).toHaveLength(1);
  });

  it('accepts an override hook read with a fallback', () => {
    expect(run([{ path: 'packages/ui/a.css', source: '.g { width: var(--wzl-swatch-size, 28px); }' }])).toEqual([]);
  });

  it('flags an override hook read without one', () => {
    const out = run([{ path: 'packages/ui/a.css', source: '.g { width: var(--wzl-swatch-size); }' }]);
    expect(out.map((o) => o.reason)).toEqual(['override hook read without a fallback']);
  });

  it('skips a name built at runtime', () => {
    expect(run([{ path: 'packages/ui/A.tsx', source: 'const c = `var(--wzl-swatch-${name})`;' }])).toEqual([]);
  });
});

describe('findThemeTokenFallbacks', () => {
  const run = (path: string, source: string) => findThemeTokenFallbacks([{ path, source }], THEME, HOOKS);

  it('flags a theme token read with a fallback, with its line', () => {
    expect(run('packages/ui/a.css', '.x {\n  color: var(--wzl-fg, #eee);\n}')).toEqual([
      { file: 'packages/ui/a.css', line: 2, name: '--wzl-fg', reason: 'theme token read with a fallback it can never take' },
    ]);
  });

  it('flags the inner read of a nested fallback too', () => {
    expect(run('packages/ui/a.less', '.x { color: var(--wzl-x, var(--wzl-fg, #eee)); }').map((o) => o.name)).toEqual(['--wzl-fg']);
  });

  it('accepts a bare theme token read and an exempt name with a fallback', () => {
    expect(run('packages/ui/a.css', '.x { color: var(--wzl-fg); width: var(--wzl-swatch-size, 28px); }')).toEqual([]);
  });

  it('leaves TS alone, where SVG markup may render outside the document', () => {
    expect(run('packages/ui/icons.ts', 'const p = `<path stroke="var(--wzl-fg, #eee)"/>`;')).toEqual([]);
  });
});

describe('findAccentFillAsText', () => {
  const run = (source: string) => findAccentFillAsText([{ path: 'packages/ui/a.css', source }]);

  it('flags text painted with an accent fill token, with its line', () => {
    expect(run('.x {\n  color: var(--wzl-accent);\n}')).toEqual([
      { file: 'packages/ui/a.css', line: 2, name: '--wzl-accent', reason: 'text painted with an accent fill; use --wzl-accent-fg' },
    ]);
    expect(run('.x { color: var(--wzl-accent-strong); }')).toHaveLength(1);
  });

  it('accepts accent-fg as text and accent fills on fill properties', () => {
    expect(run('.x { color: var(--wzl-accent-fg); }')).toEqual([]);
    expect(run('.x { background-color: var(--wzl-accent); border-color: var(--wzl-accent); accent-color: var(--wzl-accent); }')).toEqual([]);
  });

  it('ignores a commented-out declaration', () => {
    expect(run('/* color: var(--wzl-accent); */')).toEqual([]);
  });
});
