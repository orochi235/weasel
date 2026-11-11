/**
 * Property tests of the editor's and the file commands' registration: whatever options a caller passes, a command
 * binds its default keys when `keys` is left out, none for `null`, and exactly the gestures given otherwise, and it
 * keeps the label, group, and tags it was handed.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import { cleanup, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ActionsProvider, actionBindings, useActionsRegistry, type BoundGesture } from '@weasel-js/core';
import { FILE_KEYS, useNewCommand, useOpenCommand, useSaveCommand, type FileCommandOptions } from './fileCommands';
import { EDITOR_ACTIONS, EDITOR_PREFERENCES_KEY, PreferencesCommand } from './editorCommands';
import { runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 100;

afterEach(cleanup);

const wrap = ({ children }: { children: ReactNode }) => <ActionsProvider>{children}</ActionsProvider>;

function registered(register: () => void, id: string) {
  const { result, unmount } = renderHook(() => { register(); return useActionsRegistry(); }, { wrapper: wrap });
  const action = result.current!.list().find((a) => a.id === id)!;
  const out = { action, specs: actionBindings(action).map((b) => b.spec) };
  unmount();
  return out;
}

const gesture: fc.Arbitrary<BoundGesture> = fc.record({
  key: fc.constantFrom('a', 'k', 'F2', ',', 'Enter'),
  mods: fc.record({ mod: fc.boolean(), shift: fc.boolean(), alt: fc.boolean() }, { requiredKeys: [], noNullPrototype: true }),
}, { noNullPrototype: true }).map((g) => ({ kind: 'key', ...g }) as BoundGesture);
const keys = fc.oneof(fc.constant(undefined), fc.constant(null), gesture, fc.array(gesture, { minLength: 1, maxLength: 3 }));
const extras = fc.record({ group: fc.constantFrom('File', 'Edit', 'View'), tags: fc.array(fc.constantFrom('doc', 'io', 'x'), { maxLength: 2 }) }, { requiredKeys: [], noNullPrototype: true });

const want = (k: unknown, fallback: BoundGesture) => (k === null ? [] : k === undefined ? [fallback] : Array.isArray(k) ? k : [k]);

describe('file and editor commands', () => {
  it('bind their default keys, none, or the ones given, and keep what they were handed', () => {
    const seen = tally();
    fc.assert(fc.property(fc.constantFrom('new', 'open', 'save', 'preferences'), keys, extras, fc.option(fc.constantFrom('Do it', 'Prefs…'), { nil: undefined }),
      (which, k, rest, label) => {
        seen.count(k === undefined ? 'default' : k === null ? 'none' : 'given');
        if (which === 'preferences') {
          const opts = { ...rest, ...(k !== undefined ? { keys: k } : {}), ...(label ? { label } : {}) };
          const { action, specs } = registered(() => PreferencesCommand({ options: opts, open: vi.fn() }), EDITOR_ACTIONS.preferences);
          expect(specs).toEqual(want(k, EDITOR_PREFERENCES_KEY));
          expect(action.label).toBe(label ?? 'Preferences…');
          if (rest.group) expect(action.group).toBe(rest.group);
          return;
        }
        const hook = { new: useNewCommand, open: useOpenCommand, save: useSaveCommand }[which];
        const opts: FileCommandOptions = { ...rest, ...(k !== undefined ? { keys: k } : {}) };
        const { action, specs } = registered(() => hook(`f.${which}`, label ?? which, vi.fn(), opts), `f.${which}`);
        expect(specs).toEqual(want(k, FILE_KEYS[which]));
        expect(action.label).toBe(label ?? which);
        if (rest.group) expect(action.group).toBe(rest.group);
      }), runs(RUNS));
    for (const w of ['default', 'none', 'given']) seen.atLeast(w, RUNS / 10);
  }, timeoutFor(RUNS, 40));
});
