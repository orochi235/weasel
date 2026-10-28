import { useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { startCarry, type CarryPayload, type Tool } from '@weasel-js/core';
import { DragGhost } from '../DragGhost';

/** How far a press moves before it is a carry rather than a click, in CSS pixels. */
const CARRY_SLOP_PX = 4;

interface GhostState {
  node: ReactNode;
  from: Element;
  at: { left: number; top: number };
}

/** What a palette needs to make its buttons carry sources. */
export interface ToolCarry {
  /** Starts a carry of `tool` from a press on its button, when `carryTool` gives it a payload. */
  press(tool: Tool, e: PointerEvent<HTMLButtonElement>): void;
  /** Whether the click now arriving ends a carry, and so picks no tool. */
  carried(): boolean;
  /** The ghost following the pointer, while a carry with one is past its slop. */
  ghost: ReactNode;
}

/** The carry behind `ToolPalette`'s `carryTool` and `carryGhost`. */
export function useToolCarry(
  carryTool: ((tool: Tool) => CarryPayload | null) | undefined,
  carryGhost: ((tool: Tool) => ReactNode) | undefined,
): ToolCarry {
  // Set while the click that ends a carry is still to come, so the carry does not also pick its tool.
  const carried = useRef(false);
  const [ghost, setGhost] = useState<GhostState | null>(null);
  const press = (tool: Tool, e: PointerEvent<HTMLButtonElement>) => {
    const payload = e.button === 0 ? carryTool?.(tool) ?? null : null;
    if (payload === null) return;
    const origin = { x: e.clientX, y: e.clientY };
    const from = e.currentTarget;
    let moved = false;
    startCarry(from, e, payload, {
      onMove: (m) => {
        moved ||= Math.hypot(m.clientX - origin.x, m.clientY - origin.y) > CARRY_SLOP_PX;
        if (!moved || !carryGhost) return;
        const at = { left: m.clientX, top: m.clientY };
        setGhost((g) => (g ? { ...g, at } : { node: carryGhost(tool), from, at }));
      },
      onEnd: () => {
        setGhost(null);
        if (!moved) return;
        carried.current = true;
        setTimeout(() => { carried.current = false; }, 0);
      },
    });
  };
  return {
    press,
    carried: () => carried.current,
    ghost: ghost && <DragGhost at={ghost.at} from={ghost.from} centered bare>{ghost.node}</DragGhost>,
  };
}
