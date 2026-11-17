import { useMemo, useRef, useState } from 'react';
import { ActionDisabledReason, asNodeId, defineAction, defineTool, resolveFill, resolveStroke, useLatest } from '@weasel-js/core';
import type { Stroke, Fill } from '@weasel-js/core';
import {
  brightestAlphaOf,
  computeScrubbedPaints,
  type PaintSnapshot,
} from './computeScrubbedPaints';

interface ScrubSession {
  /** What this session's ticks coalesce under: one entry per run nothing interrupts. */
  coalesceKey: string;
  snapshots: Map<string, PaintSnapshot>;
  /** The brightest alpha across `snapshots`: every node scales by `targetAlpha / base`. */
  base: number;
  targetAlpha: number;
}

const COARSE_STEP = 0.05;
const FINE_STEP = 0.01;

/** The wheel's action while O is held. */
export const OPACITY_SCRUB_NUDGE = 'draw.opacityScrub.nudge';

declare module '@weasel-js/routing' {
  interface ActionParamSchema {
    /** How far one notch of the wheel moves the opacity, and the wheel's turn, which the dispatcher hands it. */
    'draw.opacityScrub.nudge': { step?: number; deltaX?: number; deltaY?: number };
  }
}

export interface UseOpacityScrubArgs {
  scene: {
    get: (id: ReturnType<typeof asNodeId>) => { data: unknown } | null;
    update: (
      id: ReturnType<typeof asNodeId>,
      patch: { data: unknown },
    ) => void;
    batch: (label: string, fn: () => void, options?: { coalesceKey?: string }) => void;
  };
  selection: { current: ReadonlyArray<string> };
}

/**
 * Hold O and turn the wheel to scrub the selection's opacity; Shift steps
 * finer. A spring-loaded tool: holding O engages it at hotkey scope, which
 * opens a session over the selection's paints. A run of wheel turns is one
 * undo entry; an edit made in between ends the run, and stays. With nothing selected no session opens and the
 * wheel falls through to the viewport.
 */
export function useOpacityScrub({ scene, selection }: UseOpacityScrubArgs) {
  const sessionRef = useRef<ScrubSession | null>(null);
  const sessionCount = useRef(0);
  const [percent, setPercent] = useState<number | null>(null);

  const sceneRef = useLatest(scene);
  const selectionRef = useLatest(selection);

  const tool = useMemo(() => {
    function readSnapshot(id: string): PaintSnapshot | null {
      const node = sceneRef.current.get(asNodeId(id));
      if (!node) return null;
      const data = (node.data ?? {}) as { fill?: Fill | null; stroke?: Stroke | null };
      if (!resolveFill(data.fill) && !resolveStroke(data.stroke)) return null;
      return { fill: data.fill, stroke: data.stroke };
    }

    function applyLive(session: ScrubSession) {
      sceneRef.current.batch('Adjust opacity', () => {
        for (const [id, snap] of session.snapshots) {
          const currentNode = sceneRef.current.get(asNodeId(id));
          if (!currentNode) continue;
          const out = computeScrubbedPaints(snap, session.targetAlpha, session.base);
          sceneRef.current.update(asNodeId(id), {
            data: {
              ...(currentNode.data as object),
              ...(out.fill !== undefined ? { fill: out.fill } : {}),
              ...(out.stroke !== undefined ? { stroke: out.stroke } : {}),
            },
          });
        }
      }, { coalesceKey: session.coalesceKey });
    }

    function snapshotsOf(ids: Iterable<string>) {
      const snapshots = new Map<string, PaintSnapshot>();
      let base = 0;
      for (const id of ids) {
        const snap = readSnapshot(id);
        if (!snap) continue;
        snapshots.set(id, snap);
        base = Math.max(base, brightestAlphaOf(snap));
      }
      return { snapshots, base };
    }

    function startSession() {
      const { snapshots, base } = snapshotsOf(selectionRef.current.current);
      if (snapshots.size === 0) return;
      sessionRef.current = {
        coalesceKey: `draw.opacityScrub:${++sessionCount.current}`,
        snapshots,
        base,
        targetAlpha: base,
      };
      setPercent(Math.round(base * 100));
    }

    // The entries `applyLive` wrote are already in history.
    function commitSession() {
      sessionRef.current = null;
      setPercent(null);
    }

    const nudge = defineAction({
      id: OPACITY_SCRUB_NUDGE,
      label: 'Adjust opacity (wheel)',
      enabled: () => (sessionRef.current ? true : ActionDisabledReason.SelectionRequired),
      invoker: {
        timing: 'immediate',
        run: (_deps, params) => {
          const session = sessionRef.current;
          if (!session) return;
          const step = params?.step ?? COARSE_STEP;
          // Held Shift turns a mouse wheel's scroll horizontal in some browsers, macOS's among them.
          const delta = params?.deltaY || (params?.deltaX ?? 0);
          session.targetAlpha = Math.max(0, Math.min(1, session.targetAlpha - Math.sign(delta) * step));
          setPercent(Math.round(session.targetAlpha * 100));
          applyLive(session);
        },
      },
    });

    return defineTool({
      id: 'opacityScrub',
      hookName: 'useOpacityScrub',
      hotkey: 'o',
      presentation: { label: 'Opacity scrub', hide: true },
      actions: [nudge],
      bindings: [
        { spec: { kind: 'wheel' }, actionId: OPACITY_SCRUB_NUDGE, opts: { id: 'opacityScrub.wheel.coarse', params: { step: COARSE_STEP } } },
        {
          spec: { kind: 'wheel', mods: { shift: true } },
          actionId: OPACITY_SCRUB_NUDGE,
          opts: { id: 'opacityScrub.wheel.fine', params: { step: FINE_STEP } },
        },
      ],
      onActivate: startSession,
      onDeactivate: commitSession,
    });
  }, [sceneRef, selectionRef, sessionCount]);

  return { tool, percent };
}
