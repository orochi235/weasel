/**
 * A small project in TypeDoc's JSON, written by hand from its published schema
 * (`JSONOutput` in `typedoc`): two packages, one with a subpath entry, holding
 * one of each kind of export the reference draws.
 */
import type { JSONOutput } from 'typedoc';

const text = (value: string) => ({ kind: 'text', text: value });
const summary = (value: string) => ({ summary: [text(value)] });
const intrinsic = (name: string) => ({ type: 'intrinsic', name });
const ref = (name: string, target: number, typeArguments?: unknown[]) => ({
  type: 'reference',
  name,
  target,
  package: '@weasel-js/geom',
  ...(typeArguments ? { typeArguments } : {}),
});
const param = (id: number, name: string, type: unknown, more: object = {}) => ({
  id,
  name,
  variant: 'param',
  kind: 32768,
  flags: {},
  type,
  ...more,
});
const source = (fileName: string, line: number) => [{ fileName, line, character: 0 }];

const box = {
  id: 10,
  name: 'Box',
  variant: 'declaration',
  kind: 256,
  flags: {},
  comment: summary('An axis-aligned rectangle. Its origin is the top-left corner.'),
  sources: source('packages/geom/src/box.ts', 4),
  children: [
    { id: 101, name: 'x', variant: 'declaration', kind: 1024, flags: {}, comment: summary('Left edge.'), type: intrinsic('number') },
    {
      id: 102,
      name: 'label',
      variant: 'declaration',
      kind: 1024,
      flags: { isOptional: true, isReadonly: true },
      type: intrinsic('string'),
    },
    {
      id: 103,
      name: 'contains',
      variant: 'declaration',
      kind: 2048,
      flags: {},
      signatures: [
        {
          id: 1031,
          name: 'contains',
          variant: 'signature',
          kind: 4096,
          flags: {},
          comment: summary('Whether a point lies inside.'),
          parameters: [param(1032, 'point', ref('Point', 11))],
          type: intrinsic('boolean'),
        },
      ],
    },
  ],
  indexSignatures: [
    {
      id: 104,
      name: '__index',
      variant: 'signature',
      kind: 8192,
      flags: {},
      parameters: [param(105, 'key', intrinsic('string'))],
      type: intrinsic('number'),
    },
  ],
};

const point = {
  id: 11,
  name: 'Point',
  variant: 'declaration',
  kind: 2097152,
  flags: {},
  comment: summary('A position in world units.'),
  type: {
    type: 'reflection',
    declaration: {
      id: 110,
      name: '__type',
      variant: 'declaration',
      kind: 65536,
      flags: {},
      children: [
        { id: 111, name: 'x', variant: 'declaration', kind: 1024, flags: {}, comment: summary('Across.'), type: intrinsic('number') },
        { id: 112, name: 'y', variant: 'declaration', kind: 1024, flags: {}, type: intrinsic('number') },
      ],
    },
  },
};

const anchor = {
  id: 12,
  name: 'Anchor',
  variant: 'declaration',
  kind: 2097152,
  flags: {},
  type: {
    type: 'union',
    types: [
      { type: 'literal', value: 'start' },
      { type: 'literal', value: null },
      { type: 'array', elementType: { type: 'union', types: [ref('Point', 11), intrinsic('number')] } },
      {
        type: 'reflection',
        declaration: {
          id: 120,
          name: '__type',
          variant: 'declaration',
          kind: 65536,
          flags: {},
          signatures: [
            {
              id: 121,
              name: '__type',
              variant: 'signature',
              kind: 4096,
              flags: {},
              parameters: [param(122, 'box', ref('Box', 10))],
              type: ref('Point', 11),
            },
          ],
        },
      },
    ],
  },
};

const unit = {
  id: 13,
  name: 'UNIT',
  variant: 'declaration',
  kind: 32,
  flags: { isConst: true },
  comment: {
    summary: [
      text('The unit '),
      { kind: 'inline-tag', tag: '@link', text: 'Box', target: 10 },
      text('. See '),
      { kind: 'inline-tag', tag: '@linkplain', text: 'the spec', target: 'https://example.com/spec' },
      text('.'),
    ],
  },
  type: ref('Box', 10),
};

const clamp = {
  id: 14,
  name: 'clamp',
  variant: 'declaration',
  kind: 64,
  flags: {},
  sources: source('packages/geom/src/scalar.ts', 12),
  signatures: [
    {
      id: 141,
      name: 'clamp',
      variant: 'signature',
      kind: 4096,
      flags: {},
      comment: {
        summary: [text('Holds a value inside a range. The range is closed.')],
        blockTags: [
          { tag: '@returns', content: [text('The nearest value in range.')] },
          { tag: '@example', content: [{ kind: 'code', text: '```ts\nclamp(5, 0, 1); // 1\n```' }] },
          { tag: '@deprecated', content: [text('Use '), { kind: 'code', text: '`clampTo`' }, text('.')] },
        ],
      },
      typeParameters: [
        { id: 1410, name: 'T', variant: 'typeParam', kind: 131072, flags: {}, type: intrinsic('number'), default: intrinsic('number') },
      ],
      parameters: [
        param(1411, 'value', { type: 'reference', name: 'T', target: 1410, refersToTypeParameter: true }, { comment: summary('What to hold.') }),
        param(1412, 'lo', intrinsic('number'), { flags: { isOptional: true } }),
        param(1413, 'rest', { type: 'array', elementType: intrinsic('number') }, { flags: { isRest: true } }),
      ],
      type: { type: 'reference', name: 'T', target: 1410, refersToTypeParameter: true },
    },
    {
      id: 142,
      name: 'clamp',
      variant: 'signature',
      kind: 4096,
      flags: {},
      parameters: [param(1421, '__namedParameters', ref('Point', 11), { defaultValue: '...' })],
      type: intrinsic('void'),
    },
  ],
};

const grid = {
  id: 15,
  name: 'Grid',
  variant: 'declaration',
  kind: 128,
  flags: {},
  typeParameters: [{ id: 150, name: 'T', variant: 'typeParam', kind: 131072, flags: {} }],
  extendedTypes: [
    {
      type: 'reference',
      name: 'EventTarget',
      target: { packageName: 'typescript', packagePath: 'lib/lib.dom.d.ts', qualifiedName: 'EventTarget' },
      package: 'typescript',
    },
  ],
  implementedTypes: [ref('Box', 10)],
  children: [
    {
      id: 151,
      name: 'constructor',
      variant: 'declaration',
      kind: 512,
      flags: {},
      signatures: [
        { id: 1511, name: 'Grid', variant: 'signature', kind: 16384, flags: {}, parameters: [param(1512, 'size', intrinsic('number'))], type: ref('Grid', 15) },
      ],
    },
    {
      id: 152,
      name: 'EMPTY',
      variant: 'declaration',
      kind: 1024,
      flags: { isStatic: true, isReadonly: true },
      type: ref('Grid', 15, [intrinsic('never')]),
    },
    {
      id: 153,
      name: 'area',
      variant: 'declaration',
      kind: 262144,
      flags: {},
      getSignature: { id: 1531, name: 'area', variant: 'signature', kind: 524288, flags: {}, comment: summary('Cells across times cells down.'), type: intrinsic('number') },
    },
    {
      id: 154,
      name: 'cellAt',
      variant: 'declaration',
      kind: 2048,
      flags: {},
      signatures: [
        {
          id: 1541,
          name: 'cellAt',
          variant: 'signature',
          kind: 4096,
          flags: {},
          parameters: [param(1542, 'at', ref('Point', 11))],
          type: { type: 'union', types: [{ type: 'reference', name: 'T', target: 150, refersToTypeParameter: true }, intrinsic('undefined')] },
        },
      ],
    },
    { id: 155, name: 'cache', variant: 'declaration', kind: 1024, flags: { isPrivate: true }, type: intrinsic('unknown') },
    {
      id: 156,
      name: 'x',
      variant: 'declaration',
      kind: 1024,
      flags: { isInherited: true },
      type: intrinsic('number'),
      inheritedFrom: { type: 'reference', name: 'Box.x', target: 101 },
    },
  ],
};

const fit = {
  id: 16,
  name: 'Fit',
  variant: 'declaration',
  kind: 8,
  flags: {},
  children: [
    { id: 161, name: 'Contain', variant: 'declaration', kind: 16, flags: {}, type: { type: 'literal', value: 0 } },
    { id: 162, name: 'Cover', variant: 'declaration', kind: 16, flags: {}, type: { type: 'literal', value: 1 } },
  ],
};

const easing = {
  id: 17,
  name: 'Easing',
  variant: 'declaration',
  kind: 4,
  flags: {},
  children: [{ id: 171, name: 'LINEAR', variant: 'declaration', kind: 32, flags: { isConst: true }, type: intrinsic('number') }],
};

const booleans = {
  id: 30,
  name: 'booleans',
  variant: 'declaration',
  kind: 2,
  flags: {},
  comment: summary('Set operations on boxes.'),
  children: [
    {
      id: 31,
      name: 'unionBoxes',
      variant: 'declaration',
      kind: 64,
      flags: {},
      signatures: [
        {
          id: 311,
          name: 'unionBoxes',
          variant: 'signature',
          kind: 4096,
          flags: {},
          parameters: [param(312, 'boxes', { type: 'typeOperator', operator: 'readonly', target: { type: 'array', elementType: ref('Box', 10) } })],
          type: ref('Box', 10),
        },
      ],
    },
  ],
};

const geom = {
  id: 1,
  name: '@weasel-js/geom',
  variant: 'declaration',
  kind: 2,
  flags: {},
  children: [box, point, anchor, unit, clamp, grid, fit, easing, booleans],
  groups: [
    { title: 'Modules', children: [30] },
    { title: 'Namespaces', children: [17] },
    { title: 'Enumerations', children: [16] },
    { title: 'Classes', children: [15] },
    { title: 'Interfaces', children: [10] },
    { title: 'Type Aliases', children: [11, 12] },
    { title: 'Variables', children: [13] },
    { title: 'Functions', children: [14] },
  ],
};

const core = {
  id: 2,
  name: '@weasel-js/core',
  variant: 'declaration',
  kind: 2,
  flags: {},
  children: [
    { id: 20, name: 'Box', variant: 'reference', kind: 4194304, flags: {}, target: 10, sources: source('packages/core/src/index.ts', 3) },
    // TypeDoc writes a name that is both a type and a value as one reference to each.
    { id: 22, name: 'Box', variant: 'reference', kind: 4194304, flags: {}, target: 10 },
    {
      id: 21,
      name: 'fit',
      variant: 'declaration',
      kind: 64,
      flags: {},
      // What `typedoc/plugin.mjs` leaves on a function it categorizes: a comment holding only the tag.
      comment: { summary: [], blockTags: [{ tag: '@category', content: [{ kind: 'text', text: 'Viewport' }] }] },
      signatures: [
        {
          id: 211,
          name: 'fit',
          variant: 'signature',
          kind: 4096,
          flags: {},
          comment: summary('Fits a box to the view'),
          parameters: [
            param(212, 'box', {
              type: 'reference',
              name: 'Box',
              target: { packageName: '@weasel-js/geom', packagePath: 'src/box.ts', qualifiedName: 'Box' },
              package: '@weasel-js/geom',
              qualifiedName: 'Box',
            }),
          ],
          type: intrinsic('void'),
        },
      ],
    },
  ],
  categories: [{ title: 'Viewport', children: [21] }, { title: 'Geometry', children: [20, 22] }],
  groups: [{ title: 'Functions', children: [21] }],
};

export const PROJECT = {
  schemaVersion: '2.0',
  id: 0,
  name: 'weasel API',
  variant: 'project',
  kind: 1,
  flags: {},
  children: [geom, core],
  symbolIdMap: {},
  files: { entries: {}, reflections: {} },
} as unknown as JSONOutput.ProjectReflection;
