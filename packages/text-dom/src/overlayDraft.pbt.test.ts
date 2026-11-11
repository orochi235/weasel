/**
 * What an edit hands back, and the small rules around it: a seeded overlay drafts the node's own text and runs,
 * a caret holder never reaches a draft, `draftChanged` reports a draft once, `useEditingId` reports each edit's end
 * and start against a model, and the style shortcuts against their table.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { act, renderHook } from '@testing-library/react';
import { DEFAULT_TEXT_STYLE, isHardLineBreak, runsToPlainText } from '@weasel-js/text';
import { domToRuns } from './domRuns';
import { useEditingId } from './editSession';
import { draftChanged, overlayDraft } from './overlayDraft';
import { seedOverlay } from './overlaySeed';
import { CHARS, fromUnits, runs, runsArb, tally, textOf, timeoutFor, toUnits } from './pbt.fixture';
import { toggleForKey } from './styleShortcuts';

const RUNS = 200;

let overlay: HTMLDivElement;
beforeEach(() => {
  document.body.innerHTML = '';
  overlay = document.createElement('div');
  document.body.appendChild(overlay);
});

describe('overlayDraft (property)', () => {
  it('drafts a freshly seeded node as it was: its text, and its runs when it had any', () => {
    const t = tally();
    fc.assert(fc.property(textOf(CHARS), (text) => {
      overlay.replaceChildren();
      const holder = seedOverlay(overlay, text, undefined, DEFAULT_TEXT_STYLE);
      expect(overlayDraft(domToRuns(overlay), holder, undefined)).toEqual({ text });
      if (text.length > 0 && isHardLineBreak(text.charCodeAt(text.length - 1))) t.count('ends in a break');
    }), runs(RUNS));
    fc.assert(fc.property(runsArb(), (rs) => {
      overlay.replaceChildren();
      const holder = seedOverlay(overlay, runsToPlainText(rs), rs, DEFAULT_TEXT_STYLE);
      const want = fromUnits(toUnits(rs));
      const draft = overlayDraft(domToRuns(overlay), holder, rs);
      expect(draft.text).toBe(runsToPlainText(rs));
      if (rs.length > 0) expect(draft.runs).toEqual(want);
    }), runs(RUNS));
    t.atLeast('ends in a break', 20);
  }, timeoutFor(RUNS, 10));

  it('drops the holder a write leaves after a trailing break, and only that', () => {
    const t = tally();
    fc.assert(fc.property(textOf(CHARS), textOf(['\n', ' ', 'a'], 3), (text, typed) => {
      overlay.replaceChildren();
      const holder = seedOverlay(overlay, text, [{ text }], DEFAULT_TEXT_STYLE);
      // A write appends `typed` and leaves the caret at the end, as a paste does.
      const last = overlay.lastElementChild ?? overlay;
      last.appendChild(document.createTextNode(typed));
      const caret = text.length + typed.length;
      holder.edited(overlay);
      holder.wrote(overlay, caret);
      if (runsToPlainText(domToRuns(overlay)).length > caret) t.count('holder');
      expect(overlayDraft(domToRuns(overlay), holder, [{ text }]).text).toBe(text + typed);
    }), runs(RUNS));
    t.atLeast('holder', 20);
  }, timeoutFor(RUNS, 10));

  it('reports a draft changed once, and again only when it changes', () => {
    fc.assert(fc.property(fc.array(fc.constantFrom('a', 'b', 'ab'), { maxLength: 8 }), (texts) => {
      const sent = { current: JSON.stringify({ text: '' }) };
      let last = '';
      for (const text of texts) {
        expect(draftChanged(sent, { text })).toBe(text !== last);
        expect(draftChanged(sent, { text })).toBe(false);
        last = text;
      }
    }), runs(RUNS));
  });
});

describe('useEditingId (stateful)', () => {
  it('reports the end of each edit it closes, then the start of the one it opens, once each', () => {
    fc.assert(fc.property(fc.array(fc.constantFrom(null, 'a', 'b'), { maxLength: 10 }), (ids) => {
      const events: string[] = [];
      const opts = { current: { onStart: (id: string) => events.push(`start ${id}`), onEnd: (id: string) => events.push(`end ${id}`) } };
      const { result, unmount } = renderHook(() => useEditingId(opts));
      const want: string[] = [];
      let model: string | null = null;
      for (const id of ids) {
        act(() => result.current[1](id));
        if (id !== model) {
          if (model !== null) want.push(`end ${model}`);
          if (id !== null) want.push(`start ${id}`);
          model = id;
        }
        expect(result.current[0]).toBe(model);
        expect(events).toEqual(want);
      }
      unmount();
    }), runs(RUNS));
  }, timeoutFor(RUNS, 10));
});

describe('toggleForKey (property)', () => {
  const TABLE: Record<string, string> = { 'b/': 'bold', 'i/': 'italic', 'u/': 'underline', 'x/s': 'strikethrough', '=/s': 'super', '-/s': 'sub' };
  const UNSHIFT: Record<string, string> = { '+': '=', _: '-' };
  it('answers the table, under Cmd or Ctrl only, matched on the unshifted key', () => {
    const t = tally();
    fc.assert(fc.property(
      fc.constantFrom('b', 'B', 'i', 'u', 'x', 'X', 'c', 'v', 'z', '=', '+', '-', '_', 'Enter'),
      fc.boolean(), fc.boolean(), fc.boolean(), fc.boolean(),
      (key, metaKey, ctrlKey, shiftKey, altKey) => {
        const got = toggleForKey(new KeyboardEvent('keydown', { key, metaKey, ctrlKey, shiftKey, altKey }));
        const raw = key.toLowerCase();
        const want = metaKey || ctrlKey ? (TABLE[`${UNSHIFT[raw] ?? raw}/${shiftKey ? 's' : ''}`] ?? null) : null;
        expect(got).toBe(want);
        if (got) t.count('toggle');
        if ((metaKey || ctrlKey) && !shiftKey && ['x', 'c', 'v', 'z'].includes(raw)) expect(got).toBeNull();
      },
    ), runs(RUNS));
    t.atLeast('toggle', 20);
  });
});
