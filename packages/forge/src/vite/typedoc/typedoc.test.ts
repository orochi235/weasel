// @vitest-environment node
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ReadApi } from '../apiTable';
import { readTypedoc, type TypedocHref, typedocSource, withTypedoc } from './index';
import type { TdReflection, TdType } from './json';
import { signatureText, typeText } from './print';

const FIXTURE = join(import.meta.dirname, 'fixture.json');
const project: unknown = JSON.parse(readFileSync(FIXTURE, 'utf8'));
const href: TypedocHref = ({ modules, name }) => `ref:${[...modules, name].join('/')}`;
const CHART = '/repo/packages/ui/src/Chart.tsx';

describe('readTypedoc', () => {
  const docs = readTypedoc(project, 0, href);
  const chart = docs.component('Chart', CHART)!;

  it('finds a component by its name and the file it is declared in', () => {
    expect(chart).not.toBeNull();
    expect(chart.href).toBe('ref:@demo/ui/Chart');
    expect(docs.component('Chart', '/repo/packages/ui/src/Other.tsx')).toBeNull();
    expect(docs.component('Missing', CHART)).toBeNull();
  });

  it("writes a prop's comment as markdown, its links resolved and its @see and @remarks after it", () => {
    expect(chart.props.get('label')?.description).toBe(
      'Shown beside the glyph, at each [`Point`](ref:@demo/ui/Point).\n\nRead once.\n\nSee also [`ChartHandle.toModel`](ref:@demo/ui/ChartHandle)',
    );
  });

  it('writes a link without a page as its name, and a plain or URL link as written', () => {
    expect(chart.props.get('linkplain')?.description).toBe('[the docs](https://example.com/docs) and `Elsewhere`');
    const bare = readTypedoc(project, 0).component('Chart', CHART)!;
    expect(bare.href).toBeUndefined();
    expect(bare.props.get('label')?.description).toMatch(/^Shown beside the glyph, at each `Point`\./);
  });

  it('reads @default as source text, @deprecated as markdown, and where a prop is inherited from', () => {
    expect(chart.props.get('size')).toEqual({ default: "'md'" });
    expect(chart.props.get('loud')).toEqual({ deprecated: 'use `tone`' });
    expect(chart.props.get('tone')).toEqual({ description: 'The ink.', inheritedFrom: 'Toned' });
  });

  it("reads the ref handle's members, a method's every overload with it", () => {
    expect(chart.members.get('toModel')).toEqual({
      description: 'Maps a plot point to the model.',
      signatures: ['(pt: Point) => Point', '<T>(x: number, ...rest: (number | T)[]) => Point'],
    });
    expect(chart.members.get('width')).toEqual({ description: 'In pixels.', signatures: [] });
  });

  it('reads the props of a type mapped over a union and indexed by it, as a discriminated props type is', () => {
    const pill = docs.component('Pill', '/repo/packages/ui/src/Pill.tsx')!;
    expect([...pill.props.keys()]).toEqual(['tone', 'shape']);
    expect(pill.props.get('shape')).toEqual({ description: 'The outline.' });
  });

  it('reads a function component in a subpath entry, its props an inline type', () => {
    const gauge = docs.component('Gauge', '/repo/packages/ui/src/charts/Gauge.tsx')!;
    expect(gauge.href).toBe('ref:@demo/ui/charts/Gauge');
    expect(gauge.props.get('value')).toEqual({ description: 'From 0 to 1.' });
    expect(gauge.members.size).toBe(0);
  });
});

describe('readTypedoc in a project whose paths are relative to each package', () => {
  let root = '';
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'forge-typedoc-packages-'));
    for (const [dir, name] of [['ui', '@a/ui'], ['kit', '@b/kit']]) {
      mkdirSync(join(root, dir, 'src'), { recursive: true });
      writeFileSync(join(root, dir, 'package.json'), JSON.stringify({ name }));
    }
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  const button = (id: number, description: string): TdReflection => ({
    id,
    name: 'Button',
    variant: 'declaration',
    kind: 64,
    sources: [{ fileName: 'src/Button.tsx' }],
    signatures: [
      {
        id: id + 1,
        name: 'Button',
        variant: 'signature',
        kind: 4096,
        parameters: [
          {
            id: id + 2,
            name: 'props',
            variant: 'param',
            kind: 32768,
            type: {
              type: 'reflection',
              declaration: {
                id: id + 3,
                name: '__type',
                variant: 'declaration',
                kind: 65536,
                children: [{ id: id + 4, name: 'label', variant: 'declaration', kind: 1024, comment: { summary: [{ kind: 'text', text: description }] } }],
              },
            },
          },
        ],
      },
    ],
  });
  const packages = (): TdReflection => ({
    id: 0,
    name: 'docs',
    kind: 1,
    children: [
      { id: 10, name: '@a/ui', kind: 2, children: [button(11, 'The ui label.')] },
      { id: 20, name: '@b/kit', kind: 2, children: [button(21, 'The kit label.')] },
    ],
  });

  it("takes the component in the module named for the file's package, where two packages' paths share the suffix", () => {
    const docs = readTypedoc(packages(), 0);
    expect(docs.component('Button', join(root, 'kit', 'src', 'Button.tsx'))?.props.get('label')?.description).toBe('The kit label.');
    expect(docs.component('Button', join(root, 'ui', 'src', 'Button.tsx'))?.props.get('label')?.description).toBe('The ui label.');
  });
});

describe('withTypedoc', () => {
  const live = (): ReadApi => ({
    props: [
      { name: 'label', type: 'string', required: true, description: 'Shown beside the glyph, at each Point.' },
      { name: 'size', type: "'sm' | 'md'", required: false, default: "'lg'" },
      { name: 'loud', type: 'boolean', required: false },
      { name: 'fresh', type: 'number', required: false, description: 'Not built yet.' },
    ],
    inherited: [{ from: 'DomProps', count: 2 }],
    ref: {
      type: 'ChartHandle',
      members: [
        { name: 'toModel', kind: 'method', signature: '(pt: Point) => Point', readonly: false },
        { name: 'width', kind: 'property', signature: 'number', readonly: true },
      ],
    },
    types: { Point: { text: 'interface Point { x: number }' } },
    sources: [CHART],
    component: { name: 'Chart', file: CHART },
  });
  const docs = readTypedoc(project, 1000, href);
  const older = () => 500;

  it("keeps the live rows and types, and takes TypeDoc's comments, overloads and page", () => {
    const merged = withTypedoc(live(), docs, older);
    expect(merged.href).toBe('ref:@demo/ui/Chart');
    expect(merged.props.map((p) => p.name)).toEqual(['label', 'size', 'loud', 'fresh']);
    expect(merged.props[0]?.description).toMatch(/\[`Point`\]\(ref:@demo\/ui\/Point\)/);
    expect(merged.props[1]).toEqual({ name: 'size', type: "'sm' | 'md'", required: false, default: "'lg'" });
    expect(merged.props[2]?.deprecated).toBe('use `tone`');
    expect(merged.props[3]?.description).toBe('Not built yet.');
    expect(merged.ref?.members[0]).toEqual({
      name: 'toModel',
      kind: 'method',
      signature: '(pt: Point) => Point',
      readonly: false,
      description: 'Maps a plot point to the model.',
      overloads: ['<T>(x: number, ...rest: (number | T)[]) => Point'],
    });
    expect(merged.inherited).toEqual([{ from: 'DomProps', count: 2 }]);
    expect(merged.types).toEqual(live().types);
  });

  it('reads the live API alone when a file it was read from changed after the JSON was written', () => {
    expect(withTypedoc(live(), docs, () => 2000)).toEqual(live());
  });

  it('reads the live API alone without a JSON, or where TypeDoc does not document the component', () => {
    expect(withTypedoc(live(), null, older)).toEqual(live());
    const elsewhere = { ...live(), component: { name: 'Chart', file: '/repo/Other.tsx' } };
    expect(withTypedoc(elsewhere, docs, older)).toEqual(elsewhere);
  });
});

describe('typedocSource', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'forge-typedoc-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('reads nothing while the JSON is absent, and reads it once it is written', () => {
    const file = join(dir, 'typedoc.json');
    const source = typedocSource(file);
    expect(source.docs()).toBeNull();
    copyFileSync(FIXTURE, file);
    expect(source.docs()?.component('Chart', CHART)).not.toBeNull();
  });

  it('reads the JSON again when it is rewritten, and reads nothing from one it cannot parse', () => {
    const file = join(dir, 'typedoc.json');
    copyFileSync(FIXTURE, file);
    const source = typedocSource(file);
    const first = source.docs();
    expect(source.docs()).toBe(first);
    writeFileSync(file, '{ not json');
    utimesSync(file, new Date(), new Date(Date.now() + 5000));
    expect(source.docs()).toBeNull();
  });
});

describe('typeText', () => {
  it('quotes a string literal holding quotes as TypeScript would read it back', () => {
    expect(typeText({ type: 'literal', value: "it's" })).toBe("'it\\'s'");
    expect(typeText({ type: 'literal', value: 'say "hi"' })).toBe(`'say "hi"'`);
  });

  it('groups a function, a conditional, or a union where an operator would otherwise take part of it', () => {
    const fn: TdType = { type: 'reflection', declaration: { id: 1, kind: 0, name: '__type', signatures: [{ id: 2, kind: 0, name: '__type', type: { type: 'intrinsic', name: 'void' } }] } };
    const nul: TdType = { type: 'literal', value: null };
    const a: TdType = { type: 'reference', name: 'A' };
    const b: TdType = { type: 'reference', name: 'B' };
    const cond: TdType = { type: 'conditional', checkType: a, extendsType: b, trueType: a, falseType: b };
    const union: TdType = { type: 'union', types: [a, b] };
    const obj: TdType = { type: 'reflection', declaration: { id: 3, kind: 0, name: '__type', children: [{ id: 4, kind: 0, name: 'x', type: a }] } };
    expect(typeText({ type: 'union', types: [fn, nul] })).toBe('(() => void) | null');
    expect(typeText({ type: 'union', types: [cond, nul] })).toBe('(A extends B ? A : B) | null');
    expect(typeText({ type: 'intersection', types: [fn, a] })).toBe('(() => void) & A');
    expect(typeText({ type: 'typeOperator', operator: 'keyof', target: union })).toBe('keyof (A | B)');
    expect(typeText({ type: 'indexedAccess', objectType: union, indexType: { type: 'literal', value: 'k' } })).toBe("(A | B)['k']");
    expect(typeText({ type: 'union', types: [obj, nul] })).toBe('{ x: A } | null');
  });

  it('groups a union or a function that is an optional tuple element', () => {
    const union: TdType = { type: 'union', types: [{ type: 'intrinsic', name: 'number' }, { type: 'literal', value: null }] };
    const str: TdType = { type: 'intrinsic', name: 'string' };
    expect(typeText({ type: 'tuple', elements: [str, { type: 'optional', elementType: union }] })).toBe('[string, (number | null)?]');
    expect(typeText({ type: 'tuple', elements: [str, { type: 'optional', elementType: str }] })).toBe('[string, string?]');
  });

  it('prints a mapped type with its modifiers and its as clause', () => {
    const k: TdType = { type: 'reference', name: 'K' };
    const keys: TdType = { type: 'typeOperator', operator: 'keyof', target: { type: 'reference', name: 'T' } };
    const value: TdType = { type: 'indexedAccess', objectType: { type: 'reference', name: 'T' }, indexType: k };
    const mapped = (extra: Partial<TdType>): TdType => ({ type: 'mapped', parameter: 'K', parameterType: keys, templateType: value, ...extra });
    expect(typeText(mapped({ optionalModifier: '+' }))).toBe('{ [K in keyof T]?: T[K] }');
    expect(typeText(mapped({ readonlyModifier: '-', optionalModifier: '-' }))).toBe('{ -readonly [K in keyof T]-?: T[K] }');
    expect(typeText(mapped({ readonlyModifier: '+' }))).toBe('{ readonly [K in keyof T]: T[K] }');
    const renamed: TdType = { type: 'templateLiteral', head: 'on', tail: [[k, '']] };
    expect(typeText(mapped({ nameType: renamed }))).toBe('{ [K in keyof T as `on${K}`]: T[K] }');
  });

  it("prints a signature's type parameters with their constraints and defaults", () => {
    const t: TdType = { type: 'reference', name: 'T' };
    const str: TdType = { type: 'intrinsic', name: 'string' };
    const signature = {
      id: 1,
      kind: 4096,
      name: 'pick',
      typeParameters: [{ id: 2, kind: 131072, name: 'T', type: str, default: { type: 'literal', value: 'a' } }],
      parameters: [{ id: 3, kind: 32768, name: 'key', type: t }],
      type: t,
    };
    expect(signatureText(signature)).toBe("<T extends string = 'a'>(key: T) => T");
  });

  it("prints an object type's readonly members as readonly", () => {
    const a: TdType = { type: 'reference', name: 'A' };
    const child = { id: 2, kind: 1024, name: 'x', type: a, flags: { isReadonly: true, isOptional: true } };
    expect(typeText({ type: 'reflection', declaration: { id: 1, kind: 65536, name: '__type', children: [child] } })).toBe('{ readonly x?: A }');
  });

  it("prints an object type's index signatures, methods, accessors, and call signatures", () => {
    const str: TdType = { type: 'intrinsic', name: 'string' };
    const num: TdType = { type: 'intrinsic', name: 'number' };
    const unknown: TdType = { type: 'intrinsic', name: 'unknown' };
    const voidType: TdType = { type: 'intrinsic', name: 'void' };
    const param = (name: string, type: TdType) => ({ id: 9, kind: 32768, name, type });
    const index = { id: 2, kind: 8192, name: '__index', parameters: [param('key', str)], type: num };
    const onlyIndex: TdType = { type: 'reflection', declaration: { id: 1, kind: 65536, name: '__type', indexSignatures: [index] } };
    expect(typeText(onlyIndex)).toBe('{ [key: string]: number }');
    const method = { id: 3, kind: 2048, name: 'onChange', signatures: [{ id: 4, kind: 4096, name: 'onChange', parameters: [param('value', str)], type: voidType }] };
    const getter = { id: 5, kind: 262144, name: 'size', getSignature: { id: 6, kind: 524288, name: 'size', type: num } };
    const mixed = { id: 1, kind: 65536, name: '__type', children: [method, getter], indexSignatures: [{ ...index, type: unknown }] };
    expect(typeText({ type: 'reflection', declaration: mixed })).toBe(
      '{ [key: string]: unknown; onChange(value: string): void; readonly size: number }',
    );
    const call = { id: 7, kind: 4096, name: '__call', parameters: [param('x', num)], type: str };
    const callable = { id: 1, kind: 65536, name: '__type', signatures: [call], children: [{ id: 8, kind: 1024, name: 'id', type: str }] };
    expect(typeText({ type: 'reflection', declaration: callable })).toBe('{ (x: number): string; id: string }');
  });

  it('prints a construct signature with its new', () => {
    const foo: TdType = { type: 'reference', name: 'Foo' };
    const construct = { id: 2, kind: 16384, name: '__type', parameters: [{ id: 3, kind: 32768, name: 'x', type: { type: 'intrinsic', name: 'number' } }], type: foo };
    expect(typeText({ type: 'reflection', declaration: { id: 1, kind: 65536, name: '__type', signatures: [construct] } })).toBe('new (x: number) => Foo');
    const two = { id: 1, kind: 65536, name: '__type', signatures: [construct, { ...construct, parameters: [] }] };
    expect(typeText({ type: 'reflection', declaration: two })).toBe('{ new (x: number): Foo; new (): Foo }');
  });

  it('prints an inferred type with its infer, and its constraint', () => {
    const t: TdType = { type: 'reference', name: 'T' };
    const u: TdType = { type: 'reference', name: 'U' };
    const never: TdType = { type: 'intrinsic', name: 'never' };
    const arrayOf = (arg: TdType): TdType => ({ type: 'reference', name: 'Array', typeArguments: [arg] });
    const infer: TdType = { type: 'inferred', name: 'U' };
    expect(typeText({ type: 'conditional', checkType: t, extendsType: arrayOf(infer), trueType: u, falseType: never })).toBe(
      'T extends Array<infer U> ? U : never',
    );
    const bounded: TdType = { type: 'inferred', name: 'U', constraint: { type: 'intrinsic', name: 'string' } };
    expect(typeText({ type: 'conditional', checkType: t, extendsType: arrayOf(bounded), trueType: u, falseType: never })).toBe(
      'T extends Array<infer U extends string> ? U : never',
    );
  });
});
