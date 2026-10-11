import { useMemo, useRef, useState } from 'react';
import { ActionDisabledReason, asNodeId, defineTool, paintAlpha, resolveTextStyle, useLatest } from '@weasel-js/core';
import type { Action, FillStyle, Stroke, TextStyle } from '@weasel-js/core';
import {
  computeScrubbedPaints,
  type PaintSnapshot,
} from './computeScrubbedPaints';

interface ScrubSession {
  /** The history index just after this session's own entry, once it has written one. */
  ownIndex: number | null;
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
 * opens a session over the selection's paints. A run of wheel turns is one
 * undo entry; an edit made in between ends the run, and stays. With nothing selected no session opens and the
 * wheel falls through to the viewport.
 */
export function useOpacityScrub({ scene, selection }: UseOpacityScrubArgs) {
  const sessionRef = useRef<ScrubSession | null>(null);
  const [percent, setPercent] = useState<number | null>(null);

  const sceneRef = useLatest(scene);
  const selectionRef = useLatest(selection);

  const tool = useMemo(() => {
    function readSnapshot(id: string): PaintSnapshot | null {
      const node = sceneRef.current.get(asNodeId(id));
      if (!node) return null;
      const data = (node.data ?? {}) as {
        fill?: FillStyle | null; stroke?: Stroke | null; text?: string; style?: TextStyle;
      };
      // Text with no fill of its own paints the resolved default, so that is
      // what the scrub scales.
      const fill = data.fill === undefined && data.text !== undefined
        ? resolveTextStyle(data.style, { fill: undefined }).fill
        : data.fill;
      if (!fill && !data.stroke?.paint) return null;
      return { fill, stroke: data.stroke };
    }

    function brightestAlphaOf(snap: PaintSnapshot): number {
      return Math.max(
        snap.fill ? paintAlpha(snap.fill) : 0,
        snap.stroke?.paint ? paintAlpha(snap.stroke.paint) : 0,
      );
    }

    // A tick replaces the previous tick's entry, but only while that entry is
    // still the newest: after any other edit or an undo, it starts a new one.
    function applyLive(session: ScrubSession) {
      const history = sceneRef.current;
      if (session.ownIndex !== null && history.historyIndex() === session.ownIndex) {
        history.jumpToHistoryIndex(session.ownIndex - 1);
      }
      sceneRef.current.batch('Adjust opacity', () => {
        for (const [id, snap] of session.snapshots) {
          const currentNode = sceneRef.current.get(asNodeId(id));
          if (!currentNode) continue;
          const out = computeScrubbedPaints(snap, session.targetAlpha);
          sceneRef.current.update(asNodeId(id), {
            data: {
              ...(currentNode.data as object),
              ...(out.fill !== undefined ? { fill: out.fill } : {}),
              ...(out.stroke !== undefined ? { stroke: out.stroke } : {}),
            },
          });
        }
      });
      session.ownIndex = history.historyIndex();
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
        ownIndex: null,
        snapshots,
        targetAlpha: sessionBrightest,
      };
      setPercent(Math.round(sessionBrightest * 100));
    }

    // The entries `applyLive` wrote are already in history.
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
  }, [sceneRef, selectionRef]);

  return { tool, percent };
}
