import type { ToolsApi } from '@weasel-js/core';
import { useEffect, useRef } from 'react';
import type { RenderContext } from '../instrument/types';

/** The two halves of the trial a scene's tool slot follows. */
export type TrialToolSlot = Pick<RenderContext['trial'], 'activeToolId' | 'setActiveTool'>;

/**
 * Keeps a scene canvas's active tool and the trial's tool slot one value, in
 * whichever direction it last moved: picking a tool in the trial's palette
 * activates it on the canvas, and a canvas hotkey that changes tool moves the
 * palette with it. A slot naming a tool the canvas has not registered — an
 * annotation tool on the lab's slot, say — leaves the canvas where it is.
 *
 * Returns the `onToolsCreated` to hand the `<SceneCanvas>`, chained to the one
 * the caller passes.
 */
export function useSceneToolSlot(
  slot: TrialToolSlot,
  onToolsCreated?: (tools: ToolsApi) => void,
): (tools: ToolsApi) => void {
  const tools = useRef<ToolsApi | null>(null);
  // The last active tool the canvas reported, `undefined` before its first report.
  const sceneSaw = useRef<string | null | undefined>(undefined);
  const slotSaw = useRef(slot.activeToolId);
  // A tool this hook told the canvas to take that it has not yet reported. Until
  // it does, what it reports is from before the request: writing that back to
  // the slot would undo the request, and the two sides would trade values forever.
  const asked = useRef<string | null>(null);

  const push = (target: ToolsApi, id: string | null): void => {
    if (id === null || id === target.active || !(id in target.registry)) return;
    asked.current = id;
    target.setActive(id);
  };

  const reported = (next: ToolsApi): void => {
    tools.current = next;
    onToolsCreated?.(next);
    const before = sceneSaw.current;
    sceneSaw.current = next.active;
    if (before === undefined) {
      push(next, slot.activeToolId);
      return;
    }
    if (asked.current !== null) {
      if (next.active === asked.current) asked.current = null;
      return;
    }
    if (next.active !== before && next.active !== null && next.active !== slot.activeToolId) {
      // The slot is about to say what the canvas already has; nothing to push back.
      slotSaw.current = next.active;
      slot.setActiveTool(next.active);
    }
  };

  const wanted = slot.activeToolId;
  useEffect(() => {
    if (wanted === slotSaw.current) return;
    slotSaw.current = wanted;
    if (tools.current) push(tools.current, wanted);
  }, [wanted]);

  return reported;
}
