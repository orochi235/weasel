// src/tools/defineTool.ts
import type { Tool } from './types';

/**
 * Identity helper for declaring a `Tool`. Exists for TypeScript inference:
 * passing the spec directly to a generic site loses `TScratch` inference, so
 * authors would have to spell out the type argument.
 *
 *   const pen = defineTool({
 *     id: 'pen',
 *     initScratch: () => ({ anchors: [] as Point[] }),
 *     drag: { onMove: (e, ctx) => { ctx.scratch.anchors.push(...); return 'claim'; } },
 *   });
 */
export function defineTool<TScratch = undefined>(
  spec: Tool<TScratch>,
): Tool<TScratch> {
  return spec;
}
