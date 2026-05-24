import type { Tool } from '../types';
import type { ViewportToolDef, PhaseDef, ActionFn } from './types';
import { defineTool } from './defineTool';

/** Translate a viewport-tool spec. Viewport tools have no targets,
 *  so route tables aren't allowed — drag is a function-form ActionFn.
 *  This factory delegates to defineTool after lifting the ViewportPhaseDef
 *  shape to the more permissive PhaseDef shape (which accepts both
 *  function-form and route-table drags). */
export function defineViewportTool<TScratch = void>(
  def: ViewportToolDef<TScratch>,
): Tool<TScratch> {
  const liftPhase = (phase: ViewportToolDef<TScratch>['initial']): PhaseDef<TScratch> => ({
    wheel: phase.wheel,
    keyDown: phase.keyDown,
    keyUp: phase.keyUp,
    cursor: phase.cursor,
    overlay: phase.overlay,
    claimsAll: phase.claimsAll,
    drag: phase.drag as ActionFn<TScratch> | undefined,
  });

  return defineTool<TScratch>({
    id: def.id,
    capabilities: def.capabilities,
    hookName: def.hookName,
    presentation: def.presentation,
    keybinding: def.keybinding,
    onActivate: def.onActivate,
    onDeactivate: def.onDeactivate,
    cursor: def.cursor,
    initial: liftPhase(def.initial),
    engaged: def.engaged ? liftPhase(def.engaged) : undefined,
  });
}
