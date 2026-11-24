import { describe, expect, it } from 'vitest';
import { foreignFrom } from './nativeExports.ts';
import { indexFile } from './indexFile.ts';

describe('foreignFrom', () => {
  it('does not know an import named for an Object member until it is found', () => {
    const foreign = foreignFrom({ values: {}, calls: {}, reexports: { constructor: true } });
    expect(foreign.value('toString')).toBeUndefined();
    expect(foreign.call('constructor')).toBeUndefined();
    expect(foreign.reexport('constructor')).toBe(true);
  });
});

const NATIVE = `import { meta, story } from '@weasel-js/forge';\nexport default meta({ title: 'ui/Slider' });\n`;
const names = (code: string) => indexFile(NATIVE + code, '/repo/packages/ui/src/Slider.stories.tsx', 'ui/Auto').map((e) => e.name);

describe('mayBeStory, read through indexFile', () => {
  it('keeps a story frozen, sealed, or made unextensible, and leaves out a frozen value', () => {
    const code = `
const Basic = story({ render: () => null });
export const Frozen = Object.freeze(story({ render: () => null }));
export const Sealed = Object.seal(Basic);
export const Fixed = Object.preventExtensions(Basic);
export const settings = Object.freeze({ dense: true });
`;
    expect(names(code)).toEqual(['Frozen', 'Sealed', 'Fixed']);
  });

  it('keeps an export reached through more steps than it reads', () => {
    const chain = Array.from({ length: 20 }, (_, i) => `const a${i + 1} = a${i} as typeof a${i};`).join('\n');
    const code = `const a0 = story({ render: () => null });\n${chain}\nexport const Deep = a20;\n`;
    expect(names(code)).toEqual(['Deep']);
  });
});
