// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { Project } from 'ts-morph';
import type { TraitSchemaIndex } from '../src/dev/traitSchemas.types.ts';
import { existsSync } from 'node:fs';
import { extractTraitSchemas, isWatched, watchedFilesFor } from './extract.ts';
import { extractOps } from './extract-ops.ts';
import { GESTURE_CATALOG_KEYS } from '../src/dev/registryEntries.ts';

const repoRoot = resolve(import.meta.dirname, '../../..');
let index: TraitSchemaIndex;

beforeAll(() => {
  index = extractTraitSchemas(repoRoot);
}, 120_000);

describe('extractTraitSchemas', () => {
  it('reads the SceneNode union through the re-export that declares it', () => {
    expect(index.node.kinds).toEqual(['mark', 'group']);
    const mark = index.node.variants.find((v) => v.kind === 'mark');
    expect(mark?.properties.map((p) => p.name)).toEqual(expect.arrayContaining(['id', 'kind', 'pose', 'data']));
    expect(index.node.source.file).toBe('packages/core/src/core/scene/nodeTypes.ts');
    expect(index.node.source.line).toBeGreaterThan(1);
  });
});

describe('extractOps', () => {
  it('lists every op factory the ops barrel exports, from whichever file declares it', () => {
    expect(Object.keys(index.ops)).toEqual(expect.arrayContaining([
      'createInsertOp', 'createSetDataOp', 'createSetHiddenOp', 'createSetLockedOp', 'createSetLayoutOp',
      'createSetLayerOp', 'createSetDependsOnOp', 'createArrangeOp', 'createReorderOp', 'createMoveToIndexOp',
      'createSetChildOrderOp',
    ]));
    expect(index.ops.createSetChildOrderOp?.source.file).toBe('packages/core/src/core/ops/reorder/setChildOrder.ts');
    expect(index.ops.createSetHiddenOp?.params.map((p) => p.name)).toContain('id');
  });

  it('reads the params of an args type written as a type alias', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    project.createSourceFile('/repo/packages/core/src/core/ops/index.ts', "export { createFooOp } from './foo';\n");
    project.createSourceFile('/repo/packages/core/src/core/ops/foo.ts', [
      'export type FooArgs = { id: string; label?: string };',
      'export function createFooOp(args: FooArgs): unknown { return args; }',
    ].join('\n'));
    const ops = extractOps(project, '/repo');
    expect(ops.createFooOp?.params).toEqual([
      expect.objectContaining({ name: 'id', type: 'string', optional: false }),
      expect.objectContaining({ name: 'label', type: 'string', optional: true }),
    ]);
  });
});

describe('extractActions', () => {
  it('catalogs actions declared through defineAction, a wrapper or a factory, from core and editing', () => {
    expect(Object.keys(index.actions)).toEqual(expect.arrayContaining([
      'undo', 'redo', 'viewport.dragPan', 'viewport.wheelPan', 'viewport.touchZoom', 'viewport.zoom',
      'move', 'resize', 'rotate', 'insert', 'delete',
    ]));
    expect(index.actions['viewport.touchZoom']).toMatchObject({ label: 'Touch Zoom', group: 'viewport' });
    expect(index.actions.move?.source.file).toBe('packages/editing/src/actions/move/action.ts');
  });
});

describe('extractGestures', () => {
  const SPEC_KINDS = [
    'key', 'keyHeld', 'wheel', 'pinch', 'click', 'doubleClick', 'contextMenu', 'drag', 'pointerDown',
    'hover', 'longPress', 'multiTouch', 'multiTouchTap', 'drop', 'carry', 'paste',
  ];

  it('has one entry per GestureSpec kind, with that spec\'s fields', () => {
    expect(Object.keys(index.gestures).sort()).toEqual([...SPEC_KINDS].sort());
    expect(index.gestures.drag?.fields.map((f) => f.name)).toEqual(['button', 'target', 'mods', 'phase']);
    expect(index.gestures.drag?.source?.file).toBe('packages/gestures/src/ui/spec.ts');
  });

  it('is the list the inspector\'s gesture catalog pages through', () => {
    expect([...GESTURE_CATALOG_KEYS].sort()).toEqual([...SPEC_KINDS].sort());
  });
});

describe('extractShapes', () => {
  it('has a schema per kind the insert dep builds, read from the node it builds', () => {
    expect(Object.keys(index.shapes).sort()).toEqual(
      ['ellipse', 'image', 'line', 'path', 'pencil', 'polygon', 'rect', 'star'],
    );
    const rect = index.shapes.rect!;
    expect(rect.pose.map((p) => p.name)).toEqual(expect.arrayContaining(['x', 'y', 'width', 'height']));
    expect(rect.data.map((p) => p.name)).toEqual(['path', 'fill', 'stroke']);
    expect(index.shapes.polygon?.data.map((p) => p.name)).toEqual(['path', 'generator', 'fill', 'stroke']);
    expect(index.shapes.image?.data.map((p) => p.name)).toEqual(['image']);
    expect(rect.source.file).toBe('packages/editing/src/deps/insert.ts');
  });
});

describe('watchedFilesFor', () => {
  it('names only paths that exist', () => {
    for (const path of watchedFilesFor(repoRoot)) expect(existsSync(path), path).toBe(true);
  });

  it('covers every file a schema in the index was read from', () => {
    const watched = watchedFilesFor(repoRoot);
    const sources = [
      ...Object.values(index.shapes), ...Object.values(index.ops), ...Object.values(index.actions),
      ...Object.values(index.gestures), index.node,
    ].flatMap((s) => (s.source ? [s.source.file] : []));
    for (const file of new Set(sources)) expect(isWatched(watched, resolve(repoRoot, file)), file).toBe(true);
    expect(isWatched(watched, resolve(repoRoot, 'packages/core/src/core/opsX/a.ts'))).toBe(false);
  });
});
