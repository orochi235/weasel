import { type Op, type SnapDep, useLatest } from '@weasel-js/core';
import {
  type Guide,
  type GuideStore,
  guideSnapSource,
  type Rulers,
  useGuides,
} from '@weasel-js/guides';
import { createContext, useCallback, useMemo, useRef, useState } from 'react';
import type { Point } from '../instrument/types';
import { TRIAL_GUIDES_OP } from '../trial/trialEditOp';
import type { TrialSnapshot } from '../trial/useTrialSnapshot';
import { createPointSnapDep, FREE_SNAP } from './guideSnap';
import type { TrialGuidesShown } from './types';

/** A camera offering rulers to its trial: the rulers it drew, which follow its view, and which way its world's y
 *  runs on screen against the rulers' world. */
export interface RulersTarget {
  rulers: Rulers;
  yDir: 1 | -1;
}

/** A trial's guides, and what it shows of its rulers, for the session: neither is saved. */
export interface TrialGuides {
  shown: TrialGuidesShown;
  /** `shown` as it stands now, ahead of the render that shows it. */
  shownNow: () => TrialGuidesShown;
  toggle: (which: keyof TrialGuidesShown) => void;
  /** Where the rulers write: placing a guide while they are hidden shows the guides. */
  store: GuideStore;
  /** The guides, live, with a way to hear them change. */
  getGuides: () => readonly Guide[];
  subscribe: (listener: () => void) => () => void;
  /** Whether a camera in the trial offers rulers now. */
  offered: boolean;
  offer: (target: RulersTarget) => () => void;
  /** The `snap` dep a camera without a scene hands its actions: the guides, while they and snapping are shown. */
  snapDep: SnapDep;
  /** Whether the guides snap now. */
  snapping: () => boolean;
  /** Apply guide edits as one step of the trial's undo, where its instrument records `guides.change`. */
  commit: (ops: Op[], label: string) => void;
  /** `p`, in the instrument's world, on the guide nearest it within reach; `p` itself with snapping or the guides
   *  off, or none in reach. */
  snap: (p: Point) => Point;
}

const NONE_SHOWN: TrialGuidesShown = { rulers: false, guides: false, snap: false };

/** The trial's guides, around the trial's body. `null` outside a trial. */
export const TrialGuidesContext = createContext<TrialGuides | null>(null);

/** One undo step over `ops`, named so a saved history knows to leave it out. */
function guidesStep(ops: readonly Op[], label: string): Op {
  return {
    name: TRIAL_GUIDES_OP,
    label,
    apply: () => {
      for (const op of ops) op.apply(undefined);
    },
    invert: () => guidesStep(ops.map((op) => op.invert()).reverse(), label),
  };
}

/** A trial's guides and its rulers' switches, recording guide edits through `snapshot`. */
export function useTrialGuides(snapshot: TrialSnapshot): TrialGuides {
  const [shown, setShown] = useState(NONE_SHOWN);
  const live = useRef(shown);
  const write = useCallback((next: TrialGuidesShown) => {
    live.current = next;
    setShown(next);
  }, []);
  const { addGuide, removeGuide, getGuides, subscribe } = useGuides();
  const [offers, setOffers] = useState<readonly RulersTarget[]>([]);
  const target = useRef<RulersTarget | null>(null);
  const snapshotRef = useLatest(snapshot);

  const store = useMemo<GuideStore>(
    () => ({
      addGuide: (guide, index) => {
        addGuide(guide, index);
        if (!live.current.guides) write({ ...live.current, guides: true });
      },
      removeGuide,
      getGuides,
    }),
    [addGuide, removeGuide, getGuides, write],
  );

  const offer = useCallback((t: RulersTarget) => {
    setOffers((prev) => [...prev, t]);
    target.current = t;
    return () => {
      setOffers((prev) => {
        const next = prev.filter((o) => o !== t);
        target.current = next.at(-1) ?? null;
        return next;
      });
    };
  }, []);

  // Built once: the rulers' contribution and the camera's deps close over these, and must not be rebuilt when a
  // switch flips.
  const stable = useMemo(() => {
    const snapDep = createPointSnapDep(
      [guideSnapSource({ getGuides })],
      () => target.current?.rulers.get().view ?? null,
    );
    const shownNow = (): TrialGuidesShown => live.current;
    return {
      shownNow,
      snapDep,
      snapping: (): boolean => live.current.snap && live.current.guides,
      toggle: (which: keyof TrialGuidesShown) =>
        write({ ...live.current, [which]: !live.current[which] }),
      commit: (ops: Op[], label: string) => {
        const step = guidesStep(ops, label);
        step.apply(undefined);
        snapshotRef.current('guides.change', step);
      },
      snap: (p: Point): Point => {
        const t = target.current;
        if (!t || !live.current.snap || !live.current.guides || getGuides().length === 0) return p;
        const local = { x: p.x, y: p.y * t.yDir };
        const session = snapDep.begin({ gesture: 'point', press: local });
        const out = session.at(local, FREE_SNAP).point;
        session.end();
        return { x: out.x, y: out.y * t.yDir };
      },
    };
  }, [getGuides, write, snapshotRef]);

  const offered = offers.length > 0;
  return useMemo<TrialGuides>(
    () => ({ ...stable, shown, store, getGuides, subscribe, offered, offer }),
    [stable, shown, store, getGuides, subscribe, offered, offer],
  );
}
