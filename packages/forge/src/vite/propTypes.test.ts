// @vitest-environment node
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPropReader, type PropReader } from './propTypes';

describe('createPropReader', () => {
  let root: string;
  let reader: PropReader;
  const at = (name: string) => join(root, name);

  beforeAll(async () => {
    root = realpathSync(mkdtempSync(join(tmpdir(), 'forge-props-')));
    writeFileSync(
      at('types.ts'),
      `export interface Shared {
  /** Shown beside
   *  the glyph. */
  label: string;
}
`,
    );
    writeFileSync(
      at('Chip.ts'),
      `import type { Shared } from './types';
export interface ChipProps extends Shared {
  size?: 'sm' | 'md';
  count?: number;
  disabled?: boolean;
  onPress?: () => void;
  style?: { color: string };
  mixed?: 'auto' | number;
}
export const Chip = (_props: ChipProps) => null;
export class Legacy { constructor(public props: { open: boolean }) {} }
`,
    );
    writeFileSync(
      at('chip.stories.ts'),
      `import { Chip } from './Chip';\nconst meta = { component: Chip };\nexport default meta;\nexport const A = {};\n`,
    );
    writeFileSync(at('legacy.stories.ts'), `import { Legacy } from './Chip';\nexport default { component: Legacy };\n`);
    writeFileSync(at('bare.stories.ts'), `export default { title: 'x' };\nexport const A = {};\n`);
    const stories = ['chip.stories.ts', 'legacy.stories.ts', 'bare.stories.ts'].map(at);
    const made = await createPropReader(root, () => stories);
    if (!made) throw new Error('typescript did not load');
    reader = made;
  });

  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it('gives a control to each boolean, string, number and string-union prop, and to nothing else', () => {
    const table = reader.read(at('chip.stories.ts'));
    expect(table?.argTypes).toEqual({
      size: { options: expect.arrayContaining(['sm', 'md']) },
      count: { control: { type: 'number' } },
      disabled: { control: { type: 'boolean' } },
      label: { control: { type: 'text' }, description: 'Shown beside the glyph.' },
    });
    expect(table?.argTypes.size?.options).toHaveLength(2);
  });

  it('names every file a prop is declared in, an inherited one included', () => {
    expect(reader.read(at('chip.stories.ts'))?.sources.sort()).toEqual([at('Chip.ts'), at('types.ts')]);
  });

  it('reads a class component through its props', () => {
    expect(reader.read(at('legacy.stories.ts'))?.argTypes).toEqual({ open: { control: { type: 'boolean' } } });
  });

  it('answers null for a meta naming no component', () => {
    expect(reader.read(at('bare.stories.ts'))).toBeNull();
  });

  it('sees an edit to the props', () => {
    writeFileSync(at('late.ts'), `export const Late = (_props: { on: boolean }) => null;\n`);
    writeFileSync(at('legacy.stories.ts'), `import { Late } from './late';\nexport default { component: Late };\n`);
    expect(reader.read(at('legacy.stories.ts'))?.argTypes).toEqual({ on: { control: { type: 'boolean' } } });
  });
});
