import { describe, expect, it } from 'vitest';
import { findUndeclaredReads } from './check-token-reads';

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
});
