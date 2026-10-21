// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { html } from './html';
import { shellAllowOrigins, shellTitle } from './shellTitle';

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

describe('shellAllowOrigins', () => {
  it("reads the origins a shell config's capture.allowOrigins names, as origins, without running it", () => {
    const code = `const FONTS = ['https://fonts.googleapis.com/', 'https://fonts.gstatic.com'] as const;\nexport default defineShellConfig({ capture: { allowOrigins: FONTS } });\n`;
    expect(shellAllowOrigins(code, FILE)).toEqual(['https://fonts.googleapis.com', 'https://fonts.gstatic.com']);
  });

  it('reads none from a config with no list or one that does not parse, and skips a computed entry or one that is no URL', () => {
    expect(shellAllowOrigins(`export default defineShellConfig({ title: 'A' });\n`, FILE)).toEqual([]);
    expect(
      shellAllowOrigins(`export default defineShellConfig({ capture: { allowOrigins: [host(), 'not a url', 'https://ok.example'] } });\n`, FILE),
    ).toEqual(['https://ok.example']);
    expect(shellAllowOrigins(`export default {`, FILE)).toEqual([]);
  });
});

describe('html', () => {
  it('titles the document as given, escaped, and as weaselforge by default', () => {
    expect(html('shell-entry.js')).toContain('<title>weaselforge</title>');
    expect(html('shell-entry.js', 'serve', 'A & B <lab>')).toContain('<title>A &amp; B &lt;lab&gt;</title>');
  });
});
