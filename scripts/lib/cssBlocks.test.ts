import { describe, expect, it } from 'vitest';
import { stripComments } from './cssBlocks';

describe('stripComments', () => {
  it('blanks block and line comments, keeping every offset', () => {
    const src = 'a /* b\nc */ d // e\nf';
    const out = stripComments(src);
    expect(out).toBe('a     \n     d     \nf');
    expect(out).toHaveLength(src.length);
  });

  it('leaves a comment opener inside a string as code', () => {
    const src = "const glob = 'src/*.ts';\nconst z = { zIndex: 9999 };\n/* real */";
    expect(stripComments(src)).toBe("const glob = 'src/*.ts';\nconst z = { zIndex: 9999 };\n          ");
    expect(stripComments('const a = "//x"; // gone')).toBe('const a = "//x";        ');
    expect(stripComments('const t = `a /* ${b}`; c')).toBe('const t = `a /* ${b}`; c');
    expect(stripComments('.a { content: "/*"; z-index: 1000; }')).toBe('.a { content: "/*"; z-index: 1000; }');
  });

  it('skips an escaped quote, and ends a quoted string at a line break', () => {
    expect(stripComments("'it\\'s /*' /* x */")).toBe("'it\\'s /*'        ");
    expect(stripComments("'open\n/* x */")).toBe("'open\n       ");
  });

  it('keeps a URL scheme, which is not a line comment', () => {
    expect(stripComments('url(http://x.test/a.png)')).toBe('url(http://x.test/a.png)');
  });
});
