import type { Tool } from '../types';
import type { ViewportToolDef } from './types';
import { defineTool } from './defineTool';

/**
 * Define a tool that acts on the viewport rather than the scene.
 *
 * This used to do real work: `ViewportPhaseDef` was a narrowed `PhaseDef`
 * (no click routes, drag restricted to the function form), and the factory
 * lifted it back to the permissive shape before handing it to `defineTool`.
 * With phase tables gone there is no shape left to narrow — a viewport tool
 * declares `bindings` like any other, pointing at `viewport.*` actions.
 *
 * It survives as an authoring signal. `defineViewportTool` at the top of a
 * hook says "this tool moves the camera, not the drawing", which is worth
 * more than the type gymnastics it replaced.
 */
export function defineViewportTool<TScratch = void>(
  def: ViewportToolDef<TScratch>,
): Tool<TScratch> {
  return defineTool<TScratch>(def);
}
