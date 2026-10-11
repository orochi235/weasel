// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { html } from './html';
import { shellTitle } from './shellTitle';

const FILE = '/repo/forge.shell.tsx';

describe('shellTitle', () => {
  it("reads the title a shell config's default export names, without running it", () => {
    const code = `import { defineShellConfig } from '@weasel-js/forge';\nexport default defineShellConfig({ title: 'Acme workshop', globals: {} });\n`;
    expect(shellTitle(code, FILE)).toBe('Acme workshop');
    expect(shellTitle(`const NAME = 'Acme';\nconst config = { title: NAME };\nexport default config;\n`, FILE)).toBe('Acme');
  });

  it('reads none from a config that names no title, computes one, or does not parse', () => {
    expect(shellTitle(`export default defineShellConfig({ globals: {} });\n`, FILE)).toBeUndefined();
    expect(shellTitle(`export default defineShellConfig({ title: name() });\n`, FILE)).toBeUndefined();
    expect(shellTitle(`export default {`, FILE)).toBeUndefined();
  });
});

describe('html', () => {
  it('titles the document as given, escaped, and as weaselforge by default', () => {
    expect(html('shell-entry.js')).toContain('<title>weaselforge</title>');
    expect(html('shell-entry.js', 'serve', 'A & B <lab>')).toContain('<title>A &amp; B &lt;lab&gt;</title>');
  });
});
