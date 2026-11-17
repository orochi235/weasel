// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import type { TraitSchemaIndex } from '../src/dev/traitSchemas.types.ts';
import { extractTraitSchemas } from './extract.ts';

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

});
