import { describe, expect, it } from 'vitest';
import { namedImports } from './check-doc-imports.mjs';

describe('namedImports', () => {
  it("reads each name a code block imports from a weasel entry, without aliases, types or placeholders", () => {
    const md = [
      'Text with `import { Nope } from \'@weasel-js/core\'` inline.',
      '```tsx',
      "import { SceneCanvas, type View, useScene as scene } from '@weasel-js/core';",
      "import { MinimapCanvas } from '@weasel-js/minimap';",
      "import { /* … */ } from '@weasel-js/hud/react';",
      "import { useState } from 'react';",
      '```',
      '```sh',
      "import { Shell } from '@weasel-js/core';",
      '```',
    ].join('\n');
    expect(namedImports(md)).toEqual([
      { spec: '@weasel-js/core', name: 'SceneCanvas' },
      { spec: '@weasel-js/core', name: 'View' },
      { spec: '@weasel-js/core', name: 'useScene' },
      { spec: '@weasel-js/minimap', name: 'MinimapCanvas' },
    ]);
  });
});
