import { useState, type PointerEvent, type ReactNode } from 'react';
import { startCarry, swallowNextClick, type CarryPayload, type Tool } from '@weasel-js/routing';
import { useKitSetting } from '@weasel-js/react';
import { DragGhost } from '../DragGhost';
import { isPrimaryPress, pastDragThreshold } from '@weasel-js/gestures';

interface GhostState {
  node: ReactNode;
  from: Element;
  at: { left: number; top: number };
}

/** What a palette needs to make its buttons carry sources. */
export interface ToolCarry {
  /** Starts a carry of `tool` from a press on its button, when `carryTool` gives it a payload. */
  press(tool: Tool, e: PointerEvent<HTMLButtonElement>): void;
  /** The ghost following the pointer, while a carry with one is past its slop. */
  ghost: ReactNode;
}

/** The carry behind `ToolPalette`'s `carryTool` and `carryGhost`. */
export function useToolCarry(
  carryTool: ((tool: Tool) => CarryPayload | null) | undefined,
  carryGhost: ((tool: Tool) => ReactNode) | undefined,
): ToolCarry {
  const [ghost, setGhost] = useState<GhostState | null>(null);
  const dragPx = useKitSetting('gestures.dragPx');
  const press = (tool: Tool, e: PointerEvent<HTMLButtonElement>) => {
    const payload = isPrimaryPress(e) ? carryTool?.(tool) ?? null : null;
    if (payload === null) return;
    const origin = { clientX: e.clientX, clientY: e.clientY };
    const from = e.currentTarget;
    let moved = false;
    startCarry(from, e, payload, {
      onMove: (m) => {
        moved ||= pastDragThreshold(origin, m, dragPx);
        if (!moved || !carryGhost) return;
        const at = { left: m.clientX, top: m.clientY };
        setGhost((g) => (g ? { ...g, at } : { node: carryGhost(tool), from, at }));
      },
      onEnd: ({ event }) => {
        moved ||= pastDragThreshold(origin, event, dragPx);
        setGhost(null);
        // The release's click would pick whatever button it lands on (a lone tool, or a stack that opens its menu).
        if (moved) swallowNextClick(window);
      },
      onCancel: () => { setGhost(null); },
    });
  };
  return {
    press,
    ghost: ghost && <DragGhost at={ghost.at} from={ghost.from} centered bare>{ghost.node}</DragGhost>,
  };
}
