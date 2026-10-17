import { describe, expect, it } from 'vitest';
import { moduleSpecifiers } from './moduleSpecifiers.mjs';

describe('moduleSpecifiers', () => {
  it('reads imports, re-exports, side-effect imports and dynamic imports', () => {
    const source = [
      "import { a } from './a.js';",
      "import b from 'b';",
      "import './chunk-X.js';",
      "export { c } from './c.js';",
      "export * from '@scope/d';",
      "const e = await import('./e.js');",
    ].join('\n');
    expect(moduleSpecifiers(source)).toEqual(['./a.js', 'b', './chunk-X.js', './c.js', '@scope/d', './e.js']);
  });

  it('ignores import-shaped text inside strings, templates and comments', () => {
    const source = [
      'const code = `import { useState } from "react";`;',
      "const msg = \"export { x } from 'react-dom'\";",
      "// import x from 'react';",
      "if (spec.type !== 'import') throw new Error(\"from 'nowhere'\");",
    ].join('\n');
    expect(moduleSpecifiers(source)).toEqual([]);
  });
});
