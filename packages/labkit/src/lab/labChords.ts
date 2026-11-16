/**
 * A lab's history and snapshot chords, as actions on the lab's registry, heard
 * by its key dispatcher. Each trial, and a lab with none, claims what its
 * chords step; a chord goes to the trial focus is in, and from outside every
 * trial to the lab's focused one.
 */
import {
  type Action,
  ActionDisabledReason,
  type ActionsRegistry,
  useLatest,
} from '@weasel-js/core';
import { createContext, useContext, useEffect, useState } from 'react';
import { SNAPSHOT_SHORTCUT } from '../chrome/builtins';
import { REDO_SHORTCUT, UNDO_SHORTCUT } from '../undo/useUndoKeys';

/** A chord a trial answers. */
export type LabChord = 'undo' | 'redo' | 'snapshot';

/** What one claimant answers: whether it takes `chord` now, and taking it. */
export interface ChordTarget {
  can: (chord: LabChord) => boolean;
  run: (chord: LabChord) => void;
}

/** Who a claim is for: a trial's id, or `null` for a lab with no trials. */
type Owner = string | null;

interface LabChords {
  claim: (owner: Owner, target: ChordTarget) => () => void;
}

const LabChordsContext = createContext<LabChords | null>(null);
export const LabChordsProvider = LabChordsContext.Provider;

const TRIAL_ATTR = 'data-trial-id';

function createClaims(): { claims: ReadonlyMap<Owner, ChordTarget>; chords: LabChords } {
  const claims = new Map<Owner, ChordTarget>();
  const chords: LabChords = {
    claim: (owner, target) => {
      claims.set(owner, target);
      return () => {
        if (claims.get(owner) === target) claims.delete(owner);
      };
    },
  };
  return { claims, chords };
}

const keySpec = (shortcut: { key: string; shift?: boolean }) => ({
  kind: 'key' as const,
  key: shortcut.key,
  code: `Key${shortcut.key.toUpperCase()}`,
  mods: { mod: true, ...(shortcut.shift ? { shift: true } : {}) },
});

/** The trial a key typed now belongs to: the one focus is in, else, from outside every trial, the focused one. */
function ownerNow(focusedTrialId: string | null): Owner {
  const at = document.activeElement?.closest(`[${TRIAL_ATTR}]`);
  return at ? at.getAttribute(TRIAL_ATTR) : focusedTrialId;
}

/**
 * Registers the lab's chord actions on `registry` and returns what claims them. `focusedTrialId` is read as each
 * key lands. A claim with no trial answers only where no trial does.
 */
export function useLabChordActions(
  registry: ActionsRegistry,
  focusedTrialId: string | null,
): LabChords {
  const focused = useLatest(focusedTrialId);
  const [{ claims, chords }] = useState(createClaims);
  useEffect(() => {
    const target = (): ChordTarget | undefined =>
      claims.get(ownerNow(focused.current)) ?? claims.get(null);
    const enabled = (chord: LabChord) => () =>
      target()?.can(chord) ? true : ActionDisabledReason.NotApplicable;
    const immediate = (
      id: string,
      label: string,
      chord: LabChord,
      specs: Action['defaultBinding'],
    ): Action => ({
      id,
      label,
      defaultBinding: specs,
      enabled: enabled(chord),
      invoker: { timing: 'immediate', run: () => target()?.run(chord) },
    });
    const actions: Action[] = [
      immediate('lab.undo', 'Undo', 'undo', [{ spec: keySpec(UNDO_SHORTCUT) }]),
      immediate('lab.redo', 'Redo', 'redo', [
        { spec: keySpec(REDO_SHORTCUT) },
        { spec: keySpec({ key: 'y' }) },
      ]),
      {
        id: 'lab.snapshot',
        label: 'Save snapshot',
        // Held, so a key repeat is the same press and saves nothing more.
        defaultBinding: [{ spec: { ...keySpec(SNAPSHOT_SHORTCUT), kind: 'keyHeld' } }],
        enabled: enabled('snapshot'),
        invoker: {
          timing: 'ongoing',
          start: () => {
            target()?.run('snapshot');
            return { onEnd: () => {} };
          },
        },
      },
    ];
    const offs = actions.map((a) => registry.register(a));
    return () => {
      for (const off of offs) off();
    };
  }, [registry, claims, focused]);
  return chords;
}

/** Claims the lab's chords for `owner` while mounted: a trial's id, or `null` for a lab with no trials. `target`
 *  is read as each key lands. Outside a lab it does nothing. */
export function useLabChords(owner: Owner, target: ChordTarget | null): void {
  const chords = useContext(LabChordsContext);
  const latest = useLatest(target);
  const claimed = target !== null;
  useEffect(() => {
    if (!chords || !claimed) return;
    return chords.claim(owner, {
      can: (chord) => latest.current?.can(chord) ?? false,
      run: (chord) => latest.current?.run(chord),
    });
  }, [chords, owner, claimed, latest]);
}
