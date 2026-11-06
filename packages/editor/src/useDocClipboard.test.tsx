import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ActionsProvider, ActionDisabledReason, actionBindings, useActionsRegistry } from '@weasel-js/core';
import { DOC_CLIPBOARD_ACTIONS, DOC_CLIPBOARD_KEYS, useDocClipboard, type DocClipboardOptions } from './useDocClipboard';

interface Box { id: string; x: number }
interface Clip { x: number }

function wrap({ children }: { children: ReactNode }) {
  return <ActionsProvider>{children}</ActionsProvider>;
}

/** A document of boxes that the app owns: paste writes to it, steps each copy 10 along, and selects the copies. */
function setup(extra: Partial<DocClipboardOptions<Clip>> = {}) {
  const doc = { boxes: [{ id: 'a', x: 0 }] as Box[], selection: ['a'], next: 0 };
  const { result } = renderHook(() => {
    const clipboard = useDocClipboard<Clip>({
      getSelection: () => doc.selection,
      copy: (ids) => {
        const clips = doc.boxes.filter((b) => ids.includes(b.id)).map(({ x }) => ({ x }));
        return clips.length > 0 ? clips : null;
      },
      paste: (items) => {
        const made = items.map(({ x }) => ({ id: `p${doc.next++}`, x: x + 10 }));
        doc.boxes.push(...made);
        return { ids: made.map((b) => b.id), items: made.map(({ x }) => ({ x })) };
      },
      onPaste: (ids) => { doc.selection = ids; },
      produceFlavors: () => ({}),
      ...extra,
    });
    return { clipboard, registry: useActionsRegistry()! };
  }, { wrapper: wrap });
  const action = (id: string) => result.current.registry.list().find((a) => a.id === id)!;
  const invoke = (id: string) => act(() => {
    (action(id).invoker as { run: (deps: object, params?: object) => void }).run({});
  });
  return { doc, action, invoke };
}

describe('useDocClipboard', () => {
  it('registers Copy and Paste on the kit ids, bound to Cmd/Ctrl+C and V', () => {
    const { action } = setup();
    expect(actionBindings(action(DOC_CLIPBOARD_ACTIONS.copy)).map((b) => b.spec)).toEqual([DOC_CLIPBOARD_KEYS.copy]);
    expect(actionBindings(action(DOC_CLIPBOARD_ACTIONS.paste)).map((b) => b.spec)).toEqual([DOC_CLIPBOARD_KEYS.paste]);
  });

  it('binds no key for a command whose keys are null', () => {
    const { action } = setup({ commands: { paste: { keys: null } } });
    expect(actionBindings(action(DOC_CLIPBOARD_ACTIONS.paste))).toEqual([]);
  });

  it('pastes into the document, each paste stepping on from the last', () => {
    const { doc, invoke } = setup();
    invoke(DOC_CLIPBOARD_ACTIONS.copy);
    invoke(DOC_CLIPBOARD_ACTIONS.paste);
    invoke(DOC_CLIPBOARD_ACTIONS.paste);
    expect(doc.boxes.map((b) => b.x)).toEqual([0, 10, 20]);
    expect(doc.selection).toEqual(['p1']);
  });

  it('enables Paste only once something is copied, and Copy only for a copyable selection', () => {
    const { doc, action, invoke } = setup();
    expect(action(DOC_CLIPBOARD_ACTIONS.paste).enabled!({})).toBe(ActionDisabledReason.NotApplicable);
    invoke(DOC_CLIPBOARD_ACTIONS.copy);
    expect(action(DOC_CLIPBOARD_ACTIONS.paste).enabled!({})).toBe(true);
    doc.selection = ['gone'];
    expect(action(DOC_CLIPBOARD_ACTIONS.copy).enabled!({})).toBe(ActionDisabledReason.NotApplicable);
  });

  it('keeps the last copy when a copy finds nothing to take', () => {
    const { doc, invoke } = setup();
    invoke(DOC_CLIPBOARD_ACTIONS.copy);
    doc.selection = ['gone'];
    invoke(DOC_CLIPBOARD_ACTIONS.copy);
    invoke(DOC_CLIPBOARD_ACTIONS.paste);
    expect(doc.boxes.map((b) => b.x)).toEqual([0, 10]);
  });
});
