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

  it('reads a bare return as no story', () => {
    const code = `
function make(x: number) { if (!x) return; return { title: 'x' }; }
export const A = make(1);
export const B = story({ render: () => null });
`;
    expect(names(code)).toEqual(['B']);
  });

  it('keeps a story passed through every Object method that hands back its first argument', () => {
    const code = `
const Basic = story({ render: () => null });
export const Defined = Object.defineProperty(story({ render: () => null }), 'x', { value: 1 });
export const Described = Object.defineProperties(Basic, {});
export const Reparented = Object.setPrototypeOf(Basic, null);
export const Computed = Object['freeze'](Basic);
export const value = Object.defineProperty({ a: 1 }, 'x', { value: 1 });
`;
    expect(names(code)).toEqual(['Defined', 'Described', 'Reparented', 'Computed']);
  });

  it('reads a name a function binds itself as unknown, not as the top-level one it shadows', () => {
    const code = `
const s = { a: 1 };
const keep = (s: unknown) => s;
const local = (x: unknown) => { const s = x; return s; };
const call = (meta: () => unknown) => meta();
export const Param = keep(story({ render: () => null }));
export const Local = local(story({ render: () => null }));
export const Called = call(() => story({ render: () => null }));
`;
    expect(names(code)).toEqual(['Param', 'Local', 'Called']);
  });

  it('leaves out values an operator makes, a global, and a constructed global', () => {
    const code = `
export const MIN = -1;
export const label = 'a' + 'b';
export const none = undefined;
export const map = new Map();
export const Basic = story({ render: () => null });
`;
    expect(names(code)).toEqual(['Basic']);
  });
});
