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
import { SNAPSHOT_SHORTCUT } from '../chrome/trialActions';
import { REDO_BINDINGS, UNDO_BINDINGS } from '../undo/useUndoKeys';
import { createKeyClaims, type KeyClaims, useClaimed } from './keyClaims';
import { owningTrial, useOwnsTrial } from './owningTrial';

/** A chord a trial answers. */
export type LabChord = 'undo' | 'redo' | 'snapshot';

/** What one claimant answers: whether it takes `chord` now, and taking it. */
export interface ChordTarget {
  can: (chord: LabChord) => boolean;
  run: (chord: LabChord) => void;
}

/** Who a claim is for: a trial's id, or `null` for a lab with no trials. */
type Owner = string | null;

interface ChordClaim {
  owner: Owner;
  target: ChordTarget;
}

type LabChords = KeyClaims<ChordClaim>;

const LabChordsContext = createContext<LabChords | null>(null);
export const LabChordsProvider = LabChordsContext.Provider;

const keySpec = (shortcut: { key: string; shift?: boolean }) => ({
  kind: 'key' as const,
  key: shortcut.key,
  mods: { mod: true, ...(shortcut.shift ? { shift: true } : {}) },
});

/** The trial a key typed now belongs to: the lab's trial focus is in, else, from outside every one, the focused one. */
function ownerNow(focusedTrialId: string | null, owns: (id: string) => boolean): Owner {
  return owningTrial(document.activeElement, owns) ?? focusedTrialId;
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
  const owns = useLatest(useOwnsTrial());
  const [chords] = useState(() => createKeyClaims<ChordClaim>());
  const claimed = useClaimed(chords);
  useEffect(() => {
    if (!claimed) return;
    const byOwner = (owner: Owner): ChordTarget | undefined => {
      let found: ChordTarget | undefined;
      for (const c of chords.all) if (c.owner === owner) found = c.target;
      return found;
    };
    const target = (): ChordTarget | undefined =>
      byOwner(ownerNow(focused.current, owns.current)) ?? byOwner(null);
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
      immediate('lab.undo', 'Undo', 'undo', [...UNDO_BINDINGS]),
      immediate('lab.redo', 'Redo', 'redo', [...REDO_BINDINGS]),
      {
        id: 'lab.snapshot',
        label: 'Save snapshot',
        // Held, so a key repeat is the same press and saves nothing more. A text field has no use for Mod+S.
        defaultBinding: [
          { spec: { ...keySpec(SNAPSHOT_SHORTCUT), kind: 'keyHeld' }, opts: { inFields: true } },
        ],
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
  }, [registry, chords, focused, owns, claimed]);
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
    return chords.claim({
      owner,
      target: {
        can: (chord) => latest.current?.can(chord) ?? false,
        run: (chord) => latest.current?.run(chord),
      },
    });
  }, [chords, owner, claimed, latest]);
}
