/**
 * `@weasel-js/core/ops`: the kit's op factories under short names, each the same function as its `create…Op` in
 * core's source. An action commits what they build with `commitOps`, as one undo entry:
 *
 * ```ts
 * import * as ops from '@weasel-js/core/ops';
 * commitOps(ctx.deps, [ops.insert({ node }), ops.setPose({ id: node.id, from, to })], 'insert');
 * ```
 *
 * Each builds an op; the `ops.` namespace is the verb (an exception to the naming rule, 2026-11-18).
 *
 * `ops.swap` is the one not from core: `@weasel-js/history`'s `createSwapOp`, which swaps a caller-held value
 * (`{ name, label, before, after, emit }`) and never touches the scene. Swapping two nodes is editing's `swap`
 * command, committed through its `swapOps`.
 *
 * @packageDocumentation
 */
export { createSwapOp as swap } from '@weasel-js/history';
export { createArrangeOp as arrange } from '../core/ops/arrange';
export { createInsertOp as insert } from '../core/ops/create';
export { createDeleteOp as delete } from '../core/ops/delete';
export { createSetHiddenOp as setHidden, createSetLockedOp as setLocked } from '../core/ops/nodeFlags';
export {
  createMoveToIndexOp as moveToIndex, createReorderOp as reorder, createSetChildOrderOp as setChildOrder,
} from '../core/ops/reorder';
export { createDeleteNodeOp as deleteNode, createInsertNodeOp as insertNode } from '../core/ops/nodeOps';
export { createReparentOp as reparent } from '../core/ops/reparent';
export { createSetSelectionOp as setSelection } from '../core/ops/select';
export { createSetDataOp as setData } from '../core/ops/setData';
export { createSetDependsOnOp as setDependsOn } from '../core/ops/setDependsOn';
export { createSetLayerOp as setLayer } from '../core/ops/setLayer';
export { createSetLayoutOp as setLayout } from '../core/ops/setLayout';
export { createSetPathOp as setPath } from '../core/ops/setPath';
export { createSetPoseOp as setPose } from '../core/ops/setPose';
export { createSetTextOp as setText } from '../core/ops/setText';
export { createGeometryDataOp as geometryData } from '../interactions/actions/geometryProjection';
