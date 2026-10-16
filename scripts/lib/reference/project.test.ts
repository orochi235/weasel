import { describe, expect, it } from 'vitest';
import type { ClassSymbol, FunctionSymbol, ReferenceSymbol, TypeSymbol } from '../../../apps/shared/reference';
import { plain } from './code';
import { PROJECT } from './fixture';
import { readProject } from './project';

// The fixture is hand-written from TypeDoc's schema; `npm run build:api` is what reads a real one.
const [geom, core] = readProject(PROJECT);
const root = geom.modules[0];

function symbol<T extends ReferenceSymbol>(name: string, from = root): T {
  const found = from.symbols.find((s) => s.name === name);
  if (!found) throw new Error(`no export named ${name}`);
  return found as T;
}

const html = (prose: readonly { kind: string; html?: string }[]) => prose.map((block) => block.html ?? '').join('');

describe('readProject', () => {
  it('makes one reference per package, its root entry ahead of its subpaths', () => {
    expect([geom.package, core.package]).toEqual(['geom', 'core']);
    expect(geom.specifier).toBe('@weasel-js/geom');
    expect(geom.modules.map((m) => [m.name, m.specifier])).toEqual([
      ['', '@weasel-js/geom'],
      ['booleans', '@weasel-js/geom/booleans'],
    ]);
    expect(html(geom.modules[1].doc)).toBe('<p>Set operations on boxes.</p>');
  });

  it('lists exports under the headings TypeDoc grouped them by, a namespace as its members', () => {
    expect(root.groups).toEqual([
      { title: 'Namespaces', names: ['Easing.LINEAR'] },
      { title: 'Enumerations', names: ['Fit'] },
      { title: 'Classes', names: ['Grid'] },
      { title: 'Interfaces', names: ['Box'] },
      { title: 'Type Aliases', names: ['Point', 'Anchor'] },
      { title: 'Variables', names: ['UNIT'] },
      { title: 'Functions', names: ['clamp'] },
    ]);
  });

  it('prefers a package\'s @category sections to its kind groups', () => {
    expect(core.modules[0].groups.map((g) => g.title)).toEqual(['Viewport', 'Geometry']);
  });

  it('puts a module with no groups under one heading', () => {
    expect(geom.modules[1].groups).toEqual([{ title: 'Exports', names: ['unionBoxes'] }]);
  });
});

describe('a function', () => {
  const clamp = symbol<FunctionSymbol>('clamp');

  it('writes each overload as its declaration', () => {
    expect(clamp.signatures.map((s) => plain(s.code))).toEqual([
      'function clamp<T extends number = number>(value: T, lo?: number, ...rest: number[]): T',
      'function clamp(options?: Point): void',
    ]);
  });

  it('links a named type to its page and leaves a type parameter plain', () => {
    expect(clamp.signatures[1].code).toContainEqual({ text: 'Point', to: 'pkg/geom/reference/Point' });
    expect(clamp.signatures[0].code.every((token) => typeof token === 'string')).toBe(true);
  });

  it('reads its parameters, its result, and what its comment says of each', () => {
    const [first, second] = clamp.signatures;
    expect(first.params.map((p) => [p.name, plain(p.type), p.optional, html(p.doc)])).toEqual([
      ['value', 'T', false, '<p>What to hold.</p>'],
      ['lo', 'number', true, ''],
      ['rest', 'number[]', false, ''],
    ]);
    expect(html(first.returns!.doc)).toBe('<p>The nearest value in range.</p>');
    expect(second.returns).toBeNull();
  });

  it('keeps an example as a code block and takes the summary\'s first sentence', () => {
    expect(clamp.summary).toBe('Holds a value inside a range.');
    expect(clamp.signatures[0].doc).toContainEqual({ kind: 'code', code: 'clamp(5, 0, 1); // 1', language: 'ts' });
    expect(html(clamp.deprecated!)).toBe('<p>Use <code>clampTo</code>.</p>');
    expect(clamp.source).toEqual({ file: 'packages/geom/src/scalar.ts', line: 12 });
  });

  it('writes a readonly array without parentheses', () => {
    const union = symbol<FunctionSymbol>('unionBoxes', geom.modules[1]);
    expect(plain(union.signatures[0].code)).toBe('function unionBoxes(boxes: readonly Box[]): Box');
  });
});

describe('an interface or a type', () => {
  it('lists an interface\'s index signature, properties, and methods', () => {
    const box = symbol<TypeSymbol>('Box');
    expect(plain(box.code)).toBe('interface Box');
    expect(box.members.map((m) => [m.kind, plain(m.code)])).toEqual([
      ['index', '[key: string]: number'],
      ['property', 'x: number'],
      ['property', 'readonly label?: string'],
      ['method', 'contains(point: Point): boolean'],
    ]);
    expect(html(box.members[3].doc)).toBe('<p>Whether a point lies inside.</p>');
    expect(box.members[3].params?.map((p) => p.name)).toEqual(['point']);
  });

  it('lists an object type\'s fields as members', () => {
    const point = symbol<TypeSymbol>('Point');
    expect(plain(point.code)).toBe('type Point = { … }');
    expect(point.members.map((m) => plain(m.code))).toEqual(['x: number', 'y: number']);
  });

  it('writes any other alias out whole, with parentheses where the type needs them', () => {
    expect(plain(symbol<TypeSymbol>('Anchor').code)).toBe(
      'type Anchor = "start" | null | (Point | number)[] | ((box: Box) => Point)',
    );
  });

  it('writes a variable with its type, and links what its comment links', () => {
    const unit = symbol<TypeSymbol>('UNIT');
    expect(plain(unit.code)).toBe('const UNIT: Box');
    expect(html(unit.doc)).toBe(
      '<p>The unit <a href="#pkg/geom/reference/Box"><code>Box</code></a>. See <a href="https://example.com/spec">the spec</a>.</p>',
    );
    expect(unit.summary).toBe('The unit `Box`.');
  });

  it('lists an enum\'s values and a namespace\'s members', () => {
    expect(symbol<TypeSymbol>('Fit').members.map((m) => plain(m.code))).toEqual(['Contain = 0', 'Cover = 1']);
    expect(plain(symbol<TypeSymbol>('Easing.LINEAR').code)).toBe('const Easing.LINEAR: number');
  });
});

describe('a class', () => {
  const grid = symbol<ClassSymbol>('Grid');

  it('writes what it extends and implements, linking what the reference documents', () => {
    expect(plain(grid.code)).toBe('class Grid<T> extends EventTarget implements Box');
    expect(grid.code).toContainEqual({ text: 'Box', to: 'pkg/geom/reference/Box' });
    expect(grid.code).not.toContainEqual(expect.objectContaining({ text: 'EventTarget' }));
  });

  it('lists its constructor, statics, accessors, and methods, and leaves out a private member', () => {
    expect(grid.members.map((m) => [m.kind, plain(m.code)])).toEqual([
      ['constructor', 'new Grid(size: number)'],
      ['property', 'static readonly EMPTY: Grid<never>'],
      ['accessor', 'get area(): number'],
      ['method', 'cellAt(at: Point): T | undefined'],
      ['property', 'x: number'],
    ]);
    expect(grid.members[0].returns).toBeNull();
  });

  it('says where an inherited member comes from, linked to the type that declares it', () => {
    expect(grid.members[4].inheritedFrom).toEqual([{ text: 'Box.x', to: 'pkg/geom/reference/Box' }]);
  });
});

describe('across packages', () => {
  it('points a re-export at the package that declares it, with the summary written there', () => {
    const box = symbol('Box', core.modules[0]);
    expect(box).toMatchObject({ kind: 'alias', to: 'pkg/geom/reference/Box', summary: 'An axis-aligned rectangle.' });
    expect(box.source).toBeUndefined();
  });

  it('lists a name re-exported as both a type and a value once', () => {
    expect(core.modules[0].symbols.filter((s) => s.name === 'Box')).toHaveLength(1);
    expect(core.modules[0].groups.find((g) => g.title === 'Geometry')?.names).toEqual(['Box']);
  });

  it('links a type TypeDoc left unresolved by its package and name', () => {
    const fit = symbol<FunctionSymbol>('fit', core.modules[0]);
    expect(fit.signatures[0].code).toContainEqual({ text: 'Box', to: 'pkg/geom/reference/Box' });
    expect(fit.summary).toBe('Fits a box to the view');
  });
});
