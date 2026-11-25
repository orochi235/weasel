// @vitest-environment node
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ReadApi } from './apiTable';
import { createPropReader, type PropReader } from './propTypes';

describe('PropReader.api', () => {
  let root: string;
  let reader: PropReader;
  const at = (name: string) => join(root, name);
  const story = (name: string, body: string) => writeFileSync(at(`${name}.stories.ts`), body);
  const api = (name: string, fallback?: string): ReadApi | null => reader.api(at(`${name}.stories.ts`), fallback);
  const prop = (table: ReadApi | null, name: string) => table?.props.find((p) => p.name === name);

  beforeAll(async () => {
    root = realpathSync(mkdtempSync(join(tmpdir(), 'forge-api-')));
    writeFileSync(
      at('react.ts'),
      `export interface RefObject<T> { current: T }
export type RefCallback<T> = (instance: T | null) => void;
export type Ref<T> = RefCallback<T> | RefObject<T | null> | null;
export function forwardRef<T, P>(render: (props: P, ref: Ref<T>) => unknown): (props: P & { ref?: Ref<T>; key?: string }) => null {
  return render as never;
}
export function memo<C>(component: C): C { return component; }
`,
    );
    mkdirSync(at('node_modules/@types/react'), { recursive: true });
    writeFileSync(at('node_modules/@types/react/dom.d.ts'), `export interface DomProps { hidden?: boolean; title?: string }\n`);
    writeFileSync(at('node_modules/@types/react/anon.d.ts'), `export type Anon = { lang?: string } & { dir?: string };\n`);
    mkdirSync(at('node_modules/@types/react-dom'), { recursive: true });
    writeFileSync(at('node_modules/@types/react-dom/index.d.ts'), `export interface DomProps { inert?: boolean }\n`);
    writeFileSync(
      at('Chart.ts'),
      `import { forwardRef, memo } from './react';
import type { DomProps } from './node_modules/@types/react/dom';
import type { Anon } from './node_modules/@types/react/anon';
import type { DomProps as OtherDom } from './node_modules/@types/react-dom/index';
export interface Point { x: number; y: number }
export interface ChartHandle {
  /** Maps a plot point to the model. */
  toModel(pt: Point): Point;
  readonly width: number;
  label: string;
}
/** How heavy a stroke is. */
type Weight = 'thin' | 'bold';
export interface ChartProps {
  /** Shown beside
   *  the glyph. */
  label: string;
  onPress?: () => void;
  weight?: Weight;
  count?: number;
  /** @default 'md' */
  size?: 'sm' | 'md';
  /** @deprecated use tone */
  loud?: boolean;
}
export const Chart = forwardRef<ChartHandle, ChartProps>(function Chart({ count = 3, label: _label }, _ref) {
  return null;
});
export const Memo = memo(forwardRef<ChartHandle, ChartProps>(({ count = 4 }, _ref) => null));
export const Box = forwardRef<HTMLDivElement, { tall?: boolean }>((_props, _ref) => null);
export const Pane = forwardRef<HTMLDivElement & { reset(): void }, {}>((_props, _ref) => null);
export const Wrapped = (_props: DomProps & { own?: boolean }) => null;
export interface ListProps<T> { items: T[] }
export const List = <T,>(_props: ListProps<T>) => null;
export const Bare = () => null;
export const Field = ({ 'aria-label': _label = 'Field' }: { 'aria-label'?: string }) => null;
export const Clash = (_props: DomProps & OtherDom) => null;
export const Plain = (_props: Anon & { own?: boolean }) => null;
interface Field<T, C = T> { value?: T; onChange?: (value: C) => void }
export interface InputProps extends Field<string> {
  onPick?(value: string): void;
}
export const Input = (_props: InputProps) => null;
`,
    );
    story('chart', `import { Chart } from './Chart';\nexport default { component: Chart };\n`);
    story('memo', `import { Memo } from './Chart';\nconst meta = { component: Memo };\nexport default meta;\n`);
    story('box', `import { Box } from './Chart';\nexport default { component: Box };\n`);
    story('pane', `import { Pane } from './Chart';\nexport default { component: Pane };\n`);
    story('wrapped', `import { Wrapped } from './Chart';\nexport default { component: Wrapped };\n`);
    story('list', `import { List } from './Chart';\nexport default { component: List };\n`);
    story('bare', `import { Bare } from './Chart';\nexport default { component: Bare };\n`);
    story('native', `import { Chart } from './Chart';\nexport default { title: 'ui/Chart' };\nexport const A = Chart;\n`);
    story(
      'wrapper',
      `import { Chart } from './Chart';\nfunction Demo(_props: { shown: boolean }) { return Chart; }\nexport default { component: Demo };\n`,
    );
    writeFileSync(at('meta.ts'), `export interface Meta<C = unknown> { title?: string; component?: C }\n`);
    story(
      'annotated',
      `import type { Meta } from './meta';\nimport { Chart } from './Chart';\nconst meta: Meta = { component: Chart };\nexport default meta;\n`,
    );
    story(
      'annotatedWrapper',
      `import type { Meta } from './meta';\nimport { Chart } from './Chart';\nfunction Demo(_props: { shown: boolean }) { return Chart; }\nconst meta: Meta<typeof Demo> = { title: 'ui/Chart', component: Demo };\nexport default meta;\n`,
    );
    story('typedTitle', `import type { Meta } from './meta';\nimport { Chart } from './Chart';\nconst meta: Meta = { title: 'ui/Chart' };\nexport default meta;\n`);
    story('input', `import { Input } from './Chart';\nexport default { component: Input };\n`);
    story('plain', `import { Plain } from './Chart';\nexport default { component: Plain };\n`);
    story('field', `import { Field } from './Chart';\nexport default { component: Field };\n`);
    story('quoted', `import { Chart } from './Chart';\nexport default { 'component': Chart };\n`);
    story('asserted', `import type { Meta } from './meta';\nimport { Chart } from './Chart';\nexport default <Meta>{ component: Chart };\n`);
    story('spread', `import { Chart, Box } from './Chart';\nconst base = { component: Chart };\nexport default { component: Box, ...base };\n`);
    story(
      'spreadTyped',
      `import type { Meta } from './meta';\nimport { Chart } from './Chart';\nconst base: Meta = { component: Chart };\nconst meta: Meta = { ...base };\nexport default meta;\n`,
    );
    story('clash', `import { Clash } from './Chart';\nexport default { component: Clash };\n`);
    story('none', `export default { title: 'x' };\nexport const A = {};\n`);
    writeFileSync(at('layout.ts'), `export type Size = 'sm' | 'lg';\nexport interface LayoutProps { size?: Size }\n`);
    writeFileSync(
      at('Badge.ts'),
      `import type { LayoutProps } from './layout';\ninterface Size { w: number; h: number }\nexport interface BadgeProps extends LayoutProps { icon?: Size; tone?: Tone }\ntype Tone = 'calm';\nexport const Badge = (_props: BadgeProps) => null;\n`,
    );
    story('badge', `import { Badge } from './Badge';\nexport default { component: Badge };\n`);
    for (const pkg of ['a', 'b']) {
      mkdirSync(at(`pkgs/${pkg}/src`), { recursive: true });
      writeFileSync(at(`pkgs/${pkg}/package.json`), JSON.stringify({ name: `@ws/${pkg}` }));
      writeFileSync(at(`pkgs/${pkg}/src/types.ts`), `export interface ButtonProps { ${pkg}?: boolean }\n`);
    }
    writeFileSync(
      at('Twin.ts'),
      `import type { ButtonProps as A } from './pkgs/a/src/types';\nimport type { ButtonProps as B } from './pkgs/b/src/types';\nexport const Twin = (_props: A & B) => null;\n`,
    );
    story('twin', `import { Twin } from './Twin';\nexport default { component: Twin };\n`);
    writeFileSync(at('look.ts'), `export interface Props { hue?: string }\n`);
    writeFileSync(
      at('Tag.ts'),
      `import type { Props as TagLook } from './look';\ninterface Props { size?: number }\nexport const Tag = (_props: { look?: TagLook; own?: Props }) => null;\n`,
    );
    story('tag', `import { Tag } from './Tag';\nexport default { component: Tag };\n`);
    writeFileSync(at('sizes.ts'), `/** How big a chip is. */\nexport type ChipSize = 'sm' | 'md';\n`);
    writeFileSync(at('chipTypes.ts'), `import type { ChipSize } from './sizes';\nexport interface ChipProps { size?: ChipSize; tone?: string }\n`);
    writeFileSync(at('chipImpl.ts'), `import type { ChipProps } from './chipTypes';\nexport function ChipImpl({ tone = 'calm' }: ChipProps) { return null; }\n`);
    writeFileSync(
      at('Chip.ts'),
      `import { forwardRef, memo } from './react';\nimport type { ChipProps } from './chipTypes';\nimport { ChipImpl } from './chipImpl';\nfunction Inner({ size = 'md' }: ChipProps, _ref: unknown) { return null; }\nexport const Chip = memo(forwardRef<HTMLDivElement, ChipProps>(Inner));\nexport const Outer = memo(ChipImpl);\n`,
    );
    story('chip', `import { Chip } from './Chip';\nexport default { component: Chip };\n`);
    story('outer', `import { Outer } from './Chip';\nexport default { component: Outer };\n`);
    const stories = ['chart', 'memo', 'box', 'pane', 'wrapped', 'list', 'bare', 'native', 'wrapper', 'annotated', 'annotatedWrapper', 'typedTitle', 'input', 'plain', 'field', 'quoted', 'asserted', 'spread', 'spreadTyped', 'clash', 'none', 'badge', 'twin', 'tag', 'chip', 'outer'].map((n) => at(`${n}.stories.ts`));
    const made = await createPropReader(root, () => stories, { skip: (file) => file.includes('/pkgs/') });
    if (!made) throw new Error('typescript did not load');
    reader = made;
  });

  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it('lists every prop, controls or not', () => {
    const table = api('chart');
    expect(prop(table, 'onPress')).toEqual({ name: 'onPress', type: '() => void', required: false });
    expect(prop(table, 'label')).toMatchObject({ required: true, description: 'Shown beside the glyph.' });
    expect(table?.props.map((p) => p.name)).toEqual(['label', 'onPress', 'weight', 'count', 'size', 'loud']);
  });

  it('names the component and the file it is declared in, by which TypeDoc\'s output is searched', () => {
    expect(api('chart')?.component).toEqual({ name: 'Chart', file: at('Chart.ts') });
    expect(api('memo')?.component).toEqual({ name: 'Memo', file: at('Chart.ts') });
  });

  it('writes a type as its declaration spells it', () => {
    expect(prop(api('chart'), 'weight')?.type).toBe('Weight');
  });

  it('defines the project types a prop or ref member names, comments and export dropped', () => {
    const types = api('chart')?.types;
    expect(types?.Weight).toEqual({ text: "type Weight = 'thin' | 'bold';", description: 'How heavy a stroke is.' });
    expect(types?.Point?.text).toMatch(/^interface Point \{\s+x: number;\s+y: number;\s+\}$/);
    expect(types?.ChartHandle?.text).not.toContain('Maps a plot point');
    expect(Object.keys(types ?? {}).sort()).toEqual(['ChartHandle', 'Point', 'Weight']);
  });

  it('defines no type for a name that means two types among the props', () => {
    const table = api('badge');
    expect(table?.props.map((p) => p.type)).toEqual(['Size', 'Tone', 'Size']);
    expect(Object.keys(table?.types ?? {})).toEqual(['Tone']);
  });

  it('defines a type imported under another name by the name the prop writes', () => {
    const types = api('tag')?.types;
    expect(Object.keys(types ?? {}).sort()).toEqual(['Props', 'TagLook']);
    expect(types?.TagLook?.text).toContain('hue?: string');
    expect(types?.Props?.text).toContain('size?: number');
  });

  it('defines no type from a skipped package', () => {
    expect(api('wrapped')?.types).toBeUndefined();
  });

  it('reads a default from destructuring, else from @default', () => {
    expect(prop(api('chart'), 'count')?.default).toBe('3');
    expect(prop(api('chart'), 'size')?.default).toBe("'md'");
  });

  it('reads a default destructured from a quoted prop name', () => {
    expect(prop(api('field'), 'aria-label')?.default).toBe("'Field'");
  });

  it('marks a deprecated prop', () => {
    expect(prop(api('chart'), 'loud')?.deprecated).toBe('use tone');
  });

  it('collapses props declared in skipped files', () => {
    const table = api('wrapped');
    expect(table?.inherited).toEqual([{ from: 'DomProps', count: 2 }]);
    expect(table?.props.map((p) => p.name)).toEqual(['own']);
  });

  it('reads the members of a forwardRef handle', () => {
    const table = api('chart');
    expect(table?.ref?.type).toBe('ChartHandle');
    expect(table?.ref?.members).toEqual([
      { name: 'toModel', kind: 'method', signature: '(pt: Point) => Point', readonly: false, description: 'Maps a plot point to the model.' },
      { name: 'width', kind: 'property', signature: 'number', readonly: true },
      { name: 'label', kind: 'property', signature: 'string', readonly: false },
    ]);
    expect(prop(table, 'ref')).toBeUndefined();
    expect(prop(table, 'key')).toBeUndefined();
  });

  it('names a platform ref type and lists nothing', () => {
    expect(api('box')?.ref).toEqual({ type: 'HTMLDivElement', members: [] });
  });

  it('lists only the members a ref adds to a platform type it is intersected with', () => {
    expect(api('pane')?.ref?.members.map((m) => m.name)).toEqual(['reset']);
  });

  it('unwraps memo(forwardRef(fn)) for defaults and ref', () => {
    const table = api('memo');
    expect(prop(table, 'count')?.default).toBe('4');
    expect(table?.ref?.type).toBe('ChartHandle');
  });

  it('reads a generic component', () => {
    expect(prop(api('list'), 'items')?.type).toBe('T[]');
  });

  it('reads a component that takes no props', () => {
    expect(api('bare')).toEqual({ props: [], inherited: [], ref: null, sources: [at('Chart.ts')], component: { name: 'Bare', file: at('Chart.ts') } });
  });

  it('follows the fallback import for a meta with no component', () => {
    expect(api('native', 'Chart')?.ref?.type).toBe('ChartHandle');
  });

  it('reads a component named under a quoted key or through a type assertion', () => {
    expect(api('quoted')?.ref?.type).toBe('ChartHandle');
    expect(api('asserted')?.ref?.type).toBe('ChartHandle');
  });

  it('reads a component a spread after the property assigns, as the object holds it', () => {
    expect(api('spread')?.component?.name).toBe('Chart');
    expect(api('spreadTyped')?.ref?.type).toBe('ChartHandle');
  });

  it("reads the title's import, not a wrapper the story file declares itself", () => {
    expect(api('wrapper', 'Chart')?.ref?.type).toBe('ChartHandle');
    expect(prop(api('wrapper'), 'shown')).toBeDefined();
  });

  it('reads the assigned component through a typed meta', () => {
    expect(prop(api('annotated'), 'count')?.default).toBe('3');
    expect(api('annotated')?.ref?.type).toBe('ChartHandle');
    expect(api('annotatedWrapper', 'Chart')?.ref?.type).toBe('ChartHandle');
  });

  it("follows the title's import for a typed meta that names no component", () => {
    expect(api('typedTitle', 'Chart')?.ref?.type).toBe('ChartHandle');
  });

  it('prints an inherited generic prop as its instantiation, not its base type parameter', () => {
    expect(prop(api('input'), 'value')?.type).toBe('string');
    expect(prop(api('input'), 'onChange')?.type).toBe('(value: string) => void');
  });

  it('prints a method-shorthand prop as a function, not its return type', () => {
    expect(prop(api('input'), 'onPick')?.type).toBe('(value: string) => void');
  });

  it('counts apart inherited props whose types share a name in two packages, naming each package', () => {
    expect(api('clash')?.inherited).toEqual([
      { from: 'DomProps (@types/react)', count: 2 },
      { from: 'DomProps (@types/react-dom)', count: 1 },
    ]);
  });

  it('names the package an unnamed type of inherited props comes from', () => {
    expect(api('plain')?.inherited).toEqual([{ from: '@types/react', count: 2 }]);
  });

  it('names a skipped workspace package by its manifest, not by the file the props are declared in', () => {
    expect(api('twin')?.inherited).toEqual([
      { from: 'ButtonProps (@ws/a)', count: 1 },
      { from: 'ButtonProps (@ws/b)', count: 1 },
    ]);
  });

  it('returns null when nothing names a component', () => {
    expect(api('none')).toBeNull();
    expect(api('none', 'Nope')).toBeNull();
  });

  it('lists the files the API is declared in, leaving out packages', () => {
    expect(api('wrapped')?.sources).toEqual([at('Chart.ts')]);
  });

  it('lists the files of the type definitions it prints', () => {
    const table = api('chip');
    expect(table?.types?.ChipSize?.text).toBe("type ChipSize = 'sm' | 'md';");
    expect(table?.sources).toContain(at('sizes.ts'));
  });

  it('lists the files it reads destructured defaults from', () => {
    expect(api('chip')?.sources).toContain(at('Chip.ts'));
    expect(api('outer')?.sources).toEqual(expect.arrayContaining([at('Chip.ts'), at('chipImpl.ts')]));
  });

  it('reads defaults from a function a wrapping call names, in its file or imported', () => {
    expect(prop(api('chip'), 'size')?.default).toBe("'md'");
    expect(prop(api('outer'), 'tone')?.default).toBe("'calm'");
  });
});
