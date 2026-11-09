// @vitest-environment node
import { copyFileSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ReadApi } from '../apiTable';
import { readTypedoc, type TypedocHref, typedocSource, withTypedoc } from './index';

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

  it('reads a function component in a subpath entry, its props an inline type', () => {
    const gauge = docs.component('Gauge', '/repo/packages/ui/src/charts/Gauge.tsx')!;
    expect(gauge.href).toBe('ref:@demo/ui/charts/Gauge');
    expect(gauge.props.get('value')).toEqual({ description: 'From 0 to 1.' });
    expect(gauge.members.size).toBe(0);
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
