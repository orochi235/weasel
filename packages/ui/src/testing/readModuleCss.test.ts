import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readModuleCss } from './readModuleCss';

function sheets(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'readModuleCss-'));
  mkdirSync(join(root, 'shared'));
  mkdirSync(join(root, 'mod'));
  for (const [name, text] of Object.entries(files)) writeFileSync(join(root, name), text);
  return root;
}

describe('readModuleCss', () => {
  it('inlines every relative import form', () => {
    const root = sheets({
      'mod/a.css': '.a{}',
      'mod/b.css': '.b{}',
      'mod/c.css': '.c{}',
      'shared/d.css': '.d{}',
      'mod/main.css': `@import './a.css';\n@import "./b.css";\n@import url(./c.css);\n@import url('../shared/d.css');\n.main{}`,
    });
    expect(readModuleCss(join(root, 'mod/main.css'))).toBe('.a{}.b{}.c{}.d{}.main{}');
  });

  it('wraps a conditioned import in its layer, supports, and media', () => {
    const root = sheets({
      'mod/a.css': '.a{}',
      'mod/main.css': `@import './a.css' layer(base) supports(display: grid) screen and (min-width: 1px);`,
    });
    expect(readModuleCss(join(root, 'mod/main.css'))).toBe(
      '@media screen and (min-width: 1px) {\n@supports (display: grid) {\n@layer base {\n.a{}\n}\n}\n}\n',
    );
  });

  it('leaves a commented-out import and a package import alone', () => {
    const root = sheets({ 'mod/main.css': `/* @import './gone.css'; */\n@import 'pkg/x.css';\n` });
    expect(readModuleCss(join(root, 'mod/main.css'))).toBe(`/* @import './gone.css'; */\n@import 'pkg/x.css';\n`);
  });

  it('throws on sheets that import each other', () => {
    const root = sheets({ 'mod/a.css': `@import './b.css';`, 'mod/b.css': `@import './a.css';` });
    expect(() => readModuleCss(join(root, 'mod/a.css'))).toThrow(/imports itself/);
  });
});
