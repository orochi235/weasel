// src/tools/useTools.ts
import { useCallback, useMemo, useRef, useState } from 'react';
import { createToolsDispatcher, type ToolsDispatcher } from './dispatcher';
import type { AnyTool, ToolCtx } from './types';
import type { RenderLayer } from '../core/layers/render';

export interface UseToolsOptions {
  /** Initial active-slot tool id. Must exist in `registry`. */
  active: string;
  /** Tools eligible for the active slot or modifier slot. The keys are the
   *  tool ids; the values are the tool records. A tool with `modifier` set
   *  is wired into the modifier slot whenever the engagement state matches. */
  registry: Record<string, AnyTool>;
  /** Always-on tools — listen continuously regardless of active slot. */
  alwaysOn?: AnyTool[];
  /** Per-event base ctx supplier. `<Canvas>` wires this to inject world
   *  coords, modifiers, selection, adapter, applyBatch. Tests can supply
   *  a stub. Optional — the dispatcher works with a default empty ctx
   *  for tests that don't need the wiring. */
  getCtx?: (overrides?: {
    clientX?: number;
    clientY?: number;
    modifiers?: { alt: boolean; shift: boolean; meta: boolean; ctrl: boolean };
  }) => Omit<ToolCtx, 'scratch'>;
}

export interface ToolsApi {
  /** Current active-slot tool id. */
  active: string;
  /** Set the active-slot tool. Cancels any in-flight gesture. */
  setActive: (id: string) => void;
  /** Currently modifier-engaged tool id (or `null`). */
  modifierEngaged: string | null;
  /** Engage a modifier-slot tool by id. No-op if a gesture is in flight. */
  engageModifier: (id: string) => void;
  /** Disengage the modifier-slot tool, if any. */
  disengageModifier: () => void;
  /** All always-on tools, in registration order. */
  alwaysOn: readonly AnyTool[];
  /** Full registry — for userland UI (palette buttons, etc.). */
  registry: Readonly<Record<string, AnyTool>>;
  /** The dispatcher `<Canvas>` wires to its DOM events. */
  dispatcher: ToolsDispatcher;
  /** Increments whenever an in-flight gesture starts, transitions phase, or
   *  ends. Consumers (e.g. `<Canvas>` cursor resolution) include this in
   *  their render deps to re-evaluate derived state on real DOM events
   *  rather than waiting for an unrelated re-render. */
  gestureTick: number;
  /** Returns true if a tool with the given id is in the registry or alwaysOn list. */
  has(id: string): boolean;
  /** All overlay layers from currently-engaged tools (active slot, modifier
   *  slot if engaged, all alwaysOn slot tools). Filters out tools with no
   *  `overlay` field. Order: active, then modifier (if engaged), then
   *  alwaysOn (registration order). */
  getActiveOverlays(): RenderLayer<unknown>[];
}

const DEFAULT_CTX: Omit<ToolCtx, 'scratch'> = {
  worldX: 0,
  worldY: 0,
  modifiers: { alt: false, shift: false, meta: false, ctrl: false, space: false },
  selection: {
    get: () => [], set: () => {}, add: () => {}, remove: () => {},
    toggle: () => {}, clear: () => {}, applyClick: () => {},
  } as never,
  adapter: null,
  view: { x: 0, y: 0, scale: 1 },
  setView: () => {},
  canvasRect: typeof DOMRect !== 'undefined' ? new DOMRect() : ({ x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 } as DOMRect),
  applyBatch: () => {},
  debug: undefined,
};

export function useTools(opts: UseToolsOptions): ToolsApi {
  if (!(opts.active in opts.registry)) {
    throw new Error(`useTools: active "${opts.active}" not in registry`);
  }

  const [active, setActiveState] = useState<string>(opts.active);
  const [modifierEngaged, setModifierEngaged] = useState<string | null>(null);
  const [gestureTick, setGestureTick] = useState(0);

  // Refs so the dispatcher's getSlots/getCtx callbacks see latest values
  // without re-creating the dispatcher.
  const registryRef = useRef(opts.registry);
  registryRef.current = opts.registry;
  const alwaysOnRef = useRef(opts.alwaysOn ?? []);
  alwaysOnRef.current = opts.alwaysOn ?? [];
  const activeRef = useRef(active);
  activeRef.current = active;
  const modifierRef = useRef(modifierEngaged);
  modifierRef.current = modifierEngaged;
  const getCtxRef = useRef(opts.getCtx);
  getCtxRef.current = opts.getCtx;

  const dispatcher = useMemo(
    () =>
      createToolsDispatcher({
        getSlots: () => ({
          modifier: modifierRef.current ? registryRef.current[modifierRef.current] ?? null : null,
          active: registryRef.current[activeRef.current] ?? null,
          alwaysOn: alwaysOnRef.current,
        }),
        getCtx: (overrides) => {
          if (getCtxRef.current) return getCtxRef.current(overrides);
          return DEFAULT_CTX;
        },
        onGestureChange: () => setGestureTick((t) => t + 1),
      }),
    [],
  );

  const setActive = useCallback(
    (id: string) => {
      if (!(id in registryRef.current)) {
        throw new Error(`setActive: "${id}" not in registry`);
      }
      dispatcher.cancelGesture();
      setActiveState(id);
    },
    [dispatcher],
  );

  const engageModifier = useCallback(
    (id: string) => {
      if (dispatcher.hasActiveGesture()) return; // mid-gesture lockout
      if (!(id in registryRef.current)) {
        throw new Error(`engageModifier: "${id}" not in registry`);
      }
      setModifierEngaged(id);
    },
    [dispatcher],
  );

  const disengageModifier = useCallback(() => {
    setModifierEngaged(null);
  }, []);

  return {
    active,
    setActive,
    modifierEngaged,
    engageModifier,
    disengageModifier,
    alwaysOn: alwaysOnRef.current,
    registry: registryRef.current,
    dispatcher,
    gestureTick,
    has(id: string): boolean {
      return id in registryRef.current || alwaysOnRef.current.some(t => t.id === id);
    },
    getActiveOverlays(): RenderLayer<unknown>[] {
      const out: RenderLayer<unknown>[] = [];
      const activeTool = registryRef.current[activeRef.current];
      if (activeTool?.overlay) out.push(activeTool.overlay);
      const mod = modifierRef.current ? registryRef.current[modifierRef.current] : null;
      if (mod?.overlay) out.push(mod.overlay);
      for (const t of alwaysOnRef.current) {
        if (t.overlay) out.push(t.overlay);
      }
      return out;
    },
  };
}
