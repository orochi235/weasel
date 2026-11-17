// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { Project } from 'ts-morph';
import type { TraitSchemaIndex } from '../src/dev/traitSchemas.types.ts';
import { extractTraitSchemas } from './extract.ts';
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
      'undo', 'redo', 'viewport.dragPan', 'viewport.wheelPan', 'viewport.pinchZoom', 'viewport.zoom',
      'move', 'resize', 'rotate', 'insert', 'delete',
    ]));
    expect(index.actions['viewport.pinchZoom']).toMatchObject({ label: 'Pinch Zoom', group: 'viewport' });
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
