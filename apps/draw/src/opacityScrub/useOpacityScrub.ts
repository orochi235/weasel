import { useMemo, useRef, useState } from 'react';
import { ActionDisabledReason, asNodeId, defineTool, paintAlpha } from '@weasel-js/core';
import type { Action, FillStyle, Stroke } from '@weasel-js/core';
import {
  computeScrubbedPaints,
  type PaintSnapshot,
} from './computeScrubbedPaints';

interface ScrubSession {
  startHistoryIndex: number;
  snapshots: Map<string, PaintSnapshot>;
  targetAlpha: number;
}

const COARSE_STEP = 0.05;
const FINE_STEP = 0.01;

/** The wheel's action while O is held. */
export const OPACITY_SCRUB_NUDGE = 'draw.opacityScrub.nudge';

export interface UseOpacityScrubArgs {
  scene: {
    get: (id: ReturnType<typeof asNodeId>) => { data: unknown } | null;
    update: (
      id: ReturnType<typeof asNodeId>,
      patch: { data: unknown },
    ) => void;
    batch: (label: string, fn: () => void) => void;
    historyIndex: () => number;
    jumpToHistoryIndex: (n: number) => void;
  };
  selection: { current: ReadonlyArray<string> };
}

/**
 * Hold O and turn the wheel to scrub the selection's opacity; Shift steps
 * finer. A spring-loaded tool: holding O engages it at hotkey scope, which
 * opens a session over the selection's paints, and releasing it commits the
 * session as one undo entry. With nothing selected no session opens and the
 * wheel falls through to the viewport.
 */
export function useOpacityScrub({ scene, selection }: UseOpacityScrubArgs) {
  const sessionRef = useRef<ScrubSession | null>(null);
  const [percent, setPercent] = useState<number | null>(null);

  const sceneRef = useRef(scene);
  const selectionRef = useRef(selection);
  sceneRef.current = scene;
  selectionRef.current = selection;

  const tool = useMemo(() => {
    function readSnapshot(id: string): PaintSnapshot | null {
      const node = sceneRef.current.get(asNodeId(id));
      if (!node) return null;
      const data = node.data as { fill?: FillStyle | null; stroke?: Stroke | null } | undefined;
      return {
        fill: data?.fill ?? null,
        stroke: data?.stroke ?? null,
      };
    }

    function brightestAlphaOf(snap: PaintSnapshot): number {
      return Math.max(
        snap.fill ? paintAlpha(snap.fill) : 0,
        snap.stroke?.paint ? paintAlpha(snap.stroke.paint) : 0,
      );
    }

    // Each tick rewinds the previous tick's entry before writing, so the
    // session holds at most one 'Adjust opacity' entry, replaced in place.
    function applyLive(session: ScrubSession) {
      sceneRef.current.jumpToHistoryIndex(session.startHistoryIndex);
      sceneRef.current.batch('Adjust opacity', () => {
        for (const [id, snap] of session.snapshots) {
          const currentNode = sceneRef.current.get(asNodeId(id));
          if (!currentNode) continue;
          const out = computeScrubbedPaints(snap, session.targetAlpha);
          sceneRef.current.update(asNodeId(id), {
            data: {
              ...(currentNode.data as object),
              fill: out.fill,
              stroke: out.stroke,
            },
          });
        }
      });
    }

    function startSession() {
      const snapshots = new Map<string, PaintSnapshot>();
      let sessionBrightest = 0;
      for (const id of selectionRef.current.current) {
        const snap = readSnapshot(id);
        if (!snap) continue;
        snapshots.set(id, snap);
        sessionBrightest = Math.max(sessionBrightest, brightestAlphaOf(snap));
      }
      if (snapshots.size === 0) return;
      sessionRef.current = {
        startHistoryIndex: sceneRef.current.historyIndex(),
        snapshots,
        targetAlpha: sessionBrightest,
      };
      setPercent(Math.round(sessionBrightest * 100));
    }

    // The last `applyLive` batch is already the session's one history entry.
    function commitSession() {
      sessionRef.current = null;
      setPercent(null);
    }

    const nudge: Action = {
      id: OPACITY_SCRUB_NUDGE,
      label: 'Adjust opacity (wheel)',
      enabled: () => (sessionRef.current ? true : ActionDisabledReason.SelectionRequired),
      invoker: {
        timing: 'immediate',
        run: (_deps, params) => {
          const session = sessionRef.current;
          if (!session) return;
          const step = params?.step as number;
          const deltaY = (params?.deltaY as number | undefined) ?? 0;
          session.targetAlpha = Math.max(0, Math.min(1, session.targetAlpha - Math.sign(deltaY) * step));
          setPercent(Math.round(session.targetAlpha * 100));
          applyLive(session);
        },
      },
    };

    return defineTool<null>({
      id: 'opacityScrub',
      hotkey: 'o',
      presentation: { label: 'Opacity scrub', hide: true },
      actions: [nudge],
      bindings: [
        { spec: { kind: 'wheel' }, actionId: OPACITY_SCRUB_NUDGE, opts: { params: { step: COARSE_STEP } } },
        {
          spec: { kind: 'wheel', mods: { shift: true } },
          actionId: OPACITY_SCRUB_NUDGE,
          opts: { params: { step: FINE_STEP } },
        },
      ],
      onActivate: startSession,
      onDeactivate: commitSession,
    });
  }, []);

  return { tool, percent };
}
