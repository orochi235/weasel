import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { asNodeId, toHex8, getAlpha01 } from '@orochi235/weasel';
import {
  computeScrubbedPaints,
  type PaintSnapshot,
} from './computeScrubbedPaints';

interface ScrubSession {
  startHistoryIndex: number;
  snapshots: Map<string, PaintSnapshot>;
  startBrightest: Map<string, number>;
  targetAlpha: number;
}

const COARSE_STEP = 0.05;
const FINE_STEP = 0.01;

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
  hostRef: RefObject<HTMLElement | null>;
}

export function useOpacityScrub({ scene, selection, hostRef }: UseOpacityScrubArgs) {
  const sessionRef = useRef<ScrubSession | null>(null);
  const [percent, setPercent] = useState<number | null>(null);

  const sceneRef = useRef(scene);
  const selectionRef = useRef(selection);
  sceneRef.current = scene;
  selectionRef.current = selection;

  useEffect(() => {
    function readSnapshot(id: string): PaintSnapshot | null {
      const node = sceneRef.current.get(asNodeId(id));
      if (!node) return null;
      const data = node.data as { fill?: string | null; stroke?: string | null } | undefined;
      return {
        fill: (data?.fill ?? null) as string | null,
        stroke: (data?.stroke ?? null) as string | null,
      };
    }

    function brightestAlphaOf(snap: PaintSnapshot): number {
      const fillA =
        typeof snap.fill === 'string' && snap.fill.startsWith('#')
          ? getAlpha01(toHex8(snap.fill))
          : 0;
      const strokeA =
        typeof snap.stroke === 'string' && snap.stroke.startsWith('#')
          ? getAlpha01(toHex8(snap.stroke))
          : 0;
      return Math.max(fillA, strokeA);
    }

    // Each tick: rewind any prior tick's entry, then write the new state in
    // a single 'Adjust opacity' batch. Net effect on the history panel: at
    // most one new entry exists during the session, and it's the same entry
    // being replaced — not a growing list of intermediate edits.
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

    function startSession(): boolean {
      const ids = selectionRef.current.current;
      if (ids.length === 0) return false;

      const snapshots = new Map<string, PaintSnapshot>();
      const startBrightest = new Map<string, number>();
      let sessionBrightest = 0;
      for (const id of ids) {
        const snap = readSnapshot(id);
        if (!snap) continue;
        snapshots.set(id, snap);
        const b = brightestAlphaOf(snap);
        startBrightest.set(id, b);
        if (b > sessionBrightest) sessionBrightest = b;
      }
      if (snapshots.size === 0) return false;

      sessionRef.current = {
        startHistoryIndex: sceneRef.current.historyIndex(),
        snapshots,
        startBrightest,
        targetAlpha: sessionBrightest,
      };
      setPercent(Math.round(sessionBrightest * 100));
      return true;
    }

    function endSession(commit: boolean) {
      const session = sessionRef.current;
      sessionRef.current = null;
      setPercent(null);
      if (!session) return;

      // On commit, leave the last `applyLive` batch in place — it is already
      // the single 'Adjust opacity' history entry. On cancel, rewind it.
      if (!commit) {
        sceneRef.current.jumpToHistoryIndex(session.startHistoryIndex);
      }
    }

    function isTypingTarget(t: EventTarget | null): boolean {
      if (!(t instanceof HTMLElement)) return false;
      const tag = t.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
      if (t.isContentEditable) return true;
      return false;
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.code !== 'KeyO') return;
      if (e.repeat) return;
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      if (isTypingTarget(e.target)) return;
      if (sessionRef.current) return;
      if (startSession()) {
        e.preventDefault();
      }
    }

    function onKeyUp(e: KeyboardEvent) {
      if (e.code !== 'KeyO') return;
      if (!sessionRef.current) return;
      endSession(true);
    }

    function onBlur() {
      if (sessionRef.current) endSession(true);
    }

    function onWheel(e: WheelEvent) {
      const session = sessionRef.current;
      if (!session) return;
      e.preventDefault();
      e.stopPropagation();
      const step = e.shiftKey ? FINE_STEP : COARSE_STEP;
      const delta = -Math.sign(e.deltaY) * step;
      session.targetAlpha = Math.max(0, Math.min(1, session.targetAlpha + delta));
      setPercent(Math.round(session.targetAlpha * 100));
      applyLive(session);
    }

    window.addEventListener('keydown', onKeyDown, { capture: true });
    window.addEventListener('keyup', onKeyUp, { capture: true });
    window.addEventListener('blur', onBlur);

    const host = hostRef.current;
    host?.addEventListener('wheel', onWheel, { capture: true, passive: false });

    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true });
      window.removeEventListener('keyup', onKeyUp, { capture: true });
      window.removeEventListener('blur', onBlur);
      host?.removeEventListener('wheel', onWheel, { capture: true });
      if (sessionRef.current) endSession(false);
    };
  }, [hostRef]);

  return { percent };
}
