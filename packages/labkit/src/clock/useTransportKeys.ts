import {
  type Action,
  ActionDisabledReason,
  type ActionsRegistry,
  useLatest,
} from '@weasel-js/core';
import { createContext, type RefObject, useContext, useEffect, useState } from 'react';
import { createKeyClaims, type KeyClaims, useClaimed } from '../lab/keyClaims';
import { useLabCommandsOptional } from '../lab/LabContext';
import type { TransportControl } from './transportControl';

/** A press on one of these is its own: Space clicks a button, the arrows move
 *  a slider, and a canvas has bindings of its own on all of them. */
const OWNS_KEYS =
  'input, textarea, select, button, canvas, [role="slider"], [contenteditable=""], [contenteditable="true"]';

/** The share of a pass an arrow key moves the playhead. */
const ARROW_STEP = 0.05;

/** The keys a transport answers, by the action that answers each. */
const KEYS = [
  { id: 'lab.transport.toggle', label: 'Play or pause', key: ' ' },
  { id: 'lab.transport.faster', label: 'Faster', key: '>' },
  { id: 'lab.transport.slower', label: 'Slower', key: '<' },
  { id: 'lab.transport.forward', label: 'Step forward', key: 'ArrowRight' },
  { id: 'lab.transport.back', label: 'Step back', key: 'ArrowLeft' },
  { id: 'lab.transport.start', label: 'Go to start', key: 'Home' },
  { id: 'lab.transport.end', label: 'Go to end', key: 'End' },
  { id: 'lab.transport.reverse', label: 'Reverse', key: 'r' },
] as const;

/** One keyed transport: where it sits, and the control it works. */
interface KeyedTransport {
  anchor: () => Element | null;
  control: () => TransportControl | null;
}

type TransportKeys = KeyClaims<KeyedTransport>;

const TransportKeysContext = createContext<TransportKeys | null>(null);
export const TransportKeysProvider = TransportKeysContext.Provider;

/**
 * Registers the transport's key actions on the lab's `registry` and returns what keyed transports claim them
 * through. A key goes to the first transport that answers it, read as the key lands; `focusedTrialId` is the lab's
 * focused trial then.
 */
export function useTransportKeyActions(
  registry: ActionsRegistry,
  focusedTrialId: string | null,
): TransportKeys {
  const focused = useLatest(focusedTrialId);
  const [keys] = useState(() => createKeyClaims<KeyedTransport>());
  const keyed = useClaimed(keys);
  useEffect(() => {
    if (!keyed) return;
    const act = (key: string): (() => void) | null => {
      const at = document.activeElement;
      if (at instanceof HTMLElement && at.isContentEditable) return null;
      if (at?.closest(OWNS_KEYS)) return null;
      for (const t of keys.all) {
        const c = t.control();
        if (!c || !answersFor(t.anchor(), at, focused.current)) continue;
        const run = keyAction(key, c);
        if (run) return run;
      }
      return null;
    };
    const actions: Action[] = KEYS.map(({ id, label, key }) => ({
      id,
      label,
      defaultBinding: [{ spec: { kind: 'key', key, mods: { shift: 'optional' } } }],
      enabled: () => (act(key) ? true : ActionDisabledReason.NotApplicable),
      invoker: { timing: 'immediate', run: () => act(key)?.() },
    }));
    const offs = actions.map((a) => registry.register(a));
    return () => {
      for (const off of offs) off();
    };
  }, [registry, keys, focused, keyed]);
  return keys;
}

/**
 * Space plays and pauses, the arrows step the playhead, Home and End jump to
 * the pass's ends, R flips the direction and `<` / `>` step the speed — the
 * lab's `lab.transport.*` actions, while `enabled` and while focus is outside a
 * field, a control and a canvas. A transport inside a trial answers keys from that
 * trial, and from outside every trial while its trial is the lab's focused one,
 * as the trial's own chords do. Outside a `<Lab>` it answers none.
 */
export function useTransportKeys(
  anchor: RefObject<HTMLElement | null>,
  control: TransportControl | null,
  enabled: boolean,
): void {
  const keys = useContext(TransportKeysContext);
  const latest = useLatest(control);
  useEffect(() => {
    if (!enabled || !keys) return;
    return keys.claim({ anchor: () => anchor.current, control: () => latest.current });
  }, [anchor, enabled, keys, latest]);
}

/** The transport keys' actions for the lab around the caller, and what claims them. */
export function useLabTransportKeys(registry: ActionsRegistry): TransportKeys {
  return useTransportKeyActions(registry, useLabCommandsOptional()?.focusedTrialId ?? null);
}

const trialOf = (el: unknown): string | null =>
  el instanceof Element
    ? (el.closest('[data-trial-id]')?.getAttribute('data-trial-id') ?? null)
    : null;

/** Whether a transport at `anchor` answers a key at `target`: one outside every trial answers all. */
function answersFor(
  anchor: Element | null,
  target: Element | null,
  focused: string | null,
): boolean {
  const own = trialOf(anchor);
  if (own === null) return true;
  const from = trialOf(target);
  return from === null ? focused === null || focused === own : from === own;
}

function keyAction(key: string, c: TransportControl): (() => void) | null {
  const step = c.length * ARROW_STEP;
  switch (key) {
    case ' ':
      return () => c.toggle();
    case '>':
      return () => c.stepSpeed(1);
    case '<':
      return () => c.stepSpeed(-1);
  }
  if (!c.scrubs) return null;
  switch (key) {
    case 'ArrowRight':
      return () => c.seek(c.playhead + step);
    case 'ArrowLeft':
      return () => c.seek(c.playhead - step);
    case 'Home':
      return () => c.seek(c.start);
    case 'End':
      return () => c.seek(c.start + c.length);
    case 'r':
      return () => c.setBackward(!c.backward);
    default:
      return null;
  }
}
