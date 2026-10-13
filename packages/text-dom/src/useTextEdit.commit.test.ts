import { describe, expect, it, beforeEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useTextEdit } from './useTextEdit';
import type { StyledRun } from '@weasel-js/text';
import type { TextStyle } from '@weasel-js/text';
import {
  makeHarness,
  getOverlay,
  appendChar,
  makeRichHarness,
  selectChars,
  pressKey,
  makeTrackingHarness,
  selectCharsAndSettle,
  seedPlainOverlay,
} from './testing/textEditHarness';

describe('useTextEdit — rich-text init and commit', () => {
  it('builds a styled span overlay when getRuns returns runs', () => {
    const h = makeRichHarness({
      a: { text: 'a b', runs: [{ text: 'a ' }, { text: 'b', bold: true }] },
    });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    const spans = overlay.querySelectorAll('span[data-run]');
    expect(spans).toHaveLength(2);
    expect(spans[0].textContent).toBe('a ');
    expect((spans[1] as HTMLSpanElement).style.fontWeight).toBe('700');
  });

  it('falls back to plain text when getRuns is omitted or returns nothing', () => {
    const h = makeHarness({ a: 'hello' });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    expect(overlay.querySelectorAll('span[data-run]')).toHaveLength(0);
    expect(overlay.textContent).toBe('hello');
  });

  it('commit walks DOM via domToRuns and calls setRuns + setText', () => {
    const h = makeRichHarness({
      a: { text: 'a b', runs: [{ text: 'a ' }, { text: 'b', bold: true }] },
    });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    const tail = document.createElement('span');
    tail.setAttribute('data-run', '');
    tail.textContent = ' c';
    overlay.appendChild(tail);
    act(() => result.current.commit());
    expect(h.runCommits).toEqual([{
      id: 'a',
      runs: [{ text: 'a ' }, { text: 'b', bold: true }, { text: ' c' }],
    }]);
    expect(h.textCommits).toEqual([{ id: 'a', text: 'a b c' }]);
  });

  it('commit on a plain-text edit (no setRuns) only fires setText', () => {
    const h = makeHarness({ a: 'hi' });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    seedPlainOverlay(overlay, 'edited');
    act(() => result.current.commit());
    expect(h.commits).toEqual([{ id: 'a', text: 'edited' }]);
  });
});

describe('useTextEdit — one write per session', () => {
  function italicNode() {
    const styles: Record<string, TextStyle> = { a: { fontSize: 16, fontStyle: 'italic' } };
    const h = makeRichHarness({ a: { text: 'one two', runs: [{ text: 'one two' }] } });
    const setStyle = vi.fn((id: string, style: TextStyle) => { styles[id] = style; });
    h.opts.getStyle = (id) => styles[id];
    h.opts.setStyle = setStyle;
    return { h, styles, setStyle };
  }

  function unslantTwo(overlay: HTMLElement) {
    selectChars(overlay, 4, 7);
    act(() => { pressKey(overlay, 'i', { meta: true }); });
  }

  it('holds a rewritten node style until the commit', () => {
    const { h, setStyle } = italicNode();
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    expect(result.current.nodeStyle).toBeNull();
    unslantTwo(getOverlay(h.container)!);
    expect(setStyle).not.toHaveBeenCalled();
    expect(result.current.nodeStyle).toEqual({ fontSize: 16, fontStyle: 'normal' });

    act(() => result.current.commit());
    expect(setStyle).toHaveBeenCalledTimes(1);
    expect(setStyle).toHaveBeenCalledWith('a', { fontSize: 16, fontStyle: 'normal' });
    expect(h.runCommits[0].runs).toEqual([{ text: 'one ', italic: true }, { text: 'two' }]);
    expect(result.current.nodeStyle).toBeNull();
  });

  it('writes nothing when an edit that rewrote the node style is canceled', () => {
    const { h, styles, setStyle } = italicNode();
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    unslantTwo(getOverlay(h.container)!);
    act(() => result.current.cancelEdit());
    expect(setStyle).not.toHaveBeenCalled();
    expect(styles.a).toEqual({ fontSize: 16, fontStyle: 'italic' });
    expect(h.textCommits).toEqual([]);
    expect(h.runCommits).toEqual([]);

    // The next session starts from the node, not from what the last one held.
    act(() => result.current.startEdit('a'));
    expect(getOverlay(h.container)!.style.fontStyle).toBe('italic');
    expect(result.current.nodeStyle).toBeNull();
  });

  it('reads the held style for the next toggle in the same session', () => {
    const { h, setStyle } = italicNode();
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    unslantTwo(overlay);
    // "two" is upright now, so the same key slants it again as a run flag.
    unslantTwo(overlay);
    act(() => result.current.commit());
    expect(setStyle).toHaveBeenCalledTimes(1);
    expect(h.runCommits[0].runs).toEqual([{ text: 'one two', italic: true }]);
  });

  it('hands the whole edit to a commit option in one call, and calls no other writer', () => {
    const { h, setStyle } = italicNode();
    const commit = vi.fn();
    h.opts.commit = commit;
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    unslantTwo(overlay);
    act(() => result.current.commit());
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith('a', {
      text: 'one two',
      runs: [{ text: 'one ', italic: true }, { text: 'two' }],
      style: { fontSize: 16, fontStyle: 'normal' },
    });
    expect(setStyle).not.toHaveBeenCalled();
    expect(h.textCommits).toEqual([]);
    expect(h.runCommits).toEqual([]);
  });

  it('lowers a node flag with a commit option and no setStyle', () => {
    const { h } = italicNode();
    delete h.opts.setStyle;
    const commit = vi.fn();
    h.opts.commit = commit;
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    unslantTwo(getOverlay(h.container)!);
    act(() => result.current.commit());
    expect(commit.mock.calls[0][1].style).toEqual({ fontSize: 16, fontStyle: 'normal' });
  });

  it('leaves runs and style out of a plain edit handed to a commit option', () => {
    const h = makeRichHarness({ a: { text: 'abc' } });
    const commit = vi.fn();
    h.opts.commit = commit;
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    appendChar(getOverlay(h.container)!, 'd');
    act(() => result.current.commit());
    expect(commit).toHaveBeenCalledWith('a', { text: 'abcd' });
  });
});

describe('useTextEdit — decoration and tracking survive the commit path', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('an edit commits the keys of the runs it did not touch', () => {
    const runs: StyledRun[] = [
      { text: 'a', underline: true },
      { text: 'b', strikethrough: true, letterSpacing: 2 },
      { text: 'c', letterSpacing: 0 },
    ];
    const h = makeTrackingHarness(runs, { fontSize: 16, letterSpacing: 3 }, 32);
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    appendChar(getOverlay(h.container)!, 'd');
    act(() => result.current.commit());
    expect(h.runCommits).toEqual([
      { id: 'a', runs: [runs[0], runs[1], { text: 'cd', letterSpacing: 0 }] },
    ]);
  });

  it('Cmd-B on a tracked, decorated range keeps the other keys', () => {
    const h = makeTrackingHarness(
      [{ text: 'one two', underline: true, letterSpacing: 2 }],
      { fontSize: 16 },
    );
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    selectChars(overlay, 0, 3);
    act(() => pressKey(overlay, 'b', { meta: true }));
    act(() => result.current.commit());
    expect(h.runCommits[0].runs).toEqual([
      { text: 'one', bold: true, underline: true, letterSpacing: 2 },
      { text: ' two', underline: true, letterSpacing: 2 },
    ]);
  });
});

describe('useTextEdit — commit routes on the styling the edit produced', () => {
  it('commits runs for a node that never had any when the edit styled a range', async () => {
    const h = makeRichHarness({ a: { text: 'one two' } });
    expect(h.data.a.runs).toBeUndefined();
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    // The node had no runs, so init took the plain-text branch.
    expect(overlay.querySelectorAll('span[data-run]')).toHaveLength(0);
    seedPlainOverlay(overlay, 'one two');
    await selectCharsAndSettle(overlay, 0, 3);
    act(() => result.current.applyStyleToSelection({ bold: true }));
    act(() => result.current.commit());
    expect(h.runCommits).toEqual([{
      id: 'a',
      runs: [{ text: 'one', bold: true }, { text: ' two' }],
    }]);
    expect(h.textCommits).toEqual([{ id: 'a', text: 'one two' }]);
  });

  it('takes the setText-only path when the edit produced no styling', async () => {
    const h = makeRichHarness({ a: { text: 'one two' } });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    seedPlainOverlay(overlay, 'one too');
    await selectCharsAndSettle(overlay, 0, 3);
    act(() => result.current.commit());
    // No pointless single-run array written back to the node.
    expect(h.runCommits).toEqual([]);
    expect(h.textCommits).toEqual([{ id: 'a', text: 'one too' }]);
  });

  it('still writes runs when an edit strips the styling a node already had', () => {
    const h = makeRichHarness({ a: { text: 'ab', runs: [{ text: 'ab', bold: true }] } });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    selectChars(overlay, 0, 2);
    act(() => pressKey(overlay, 'b', { meta: true }));
    act(() => result.current.commit());
    // Routing on "did the edit produce styling" alone would leave the node's
    // stale bold run in place; the node's prior runs have to keep it rich.
    expect(h.runCommits).toEqual([{ id: 'a', runs: [{ text: 'ab' }] }]);
  });

  it('trims the caret-holder newline on the rich path too', async () => {
    // A contenteditable keeps a trailing `<br>` so the caret has somewhere to
    // sit on the last line, and `domToRuns` maps it to a literal '\n'.
    // Styling a previously-plain node takes the rich path, where one edit
    // would otherwise commit text a byte longer than the same edit unstyled.
    const h = makeRichHarness({ a: { text: 'one' } });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    overlay.replaceChildren(document.createTextNode('one'), document.createElement('br'));
    await selectCharsAndSettle(overlay, 0, 3);
    act(() => result.current.applyStyleToSelection({ bold: true }));
    act(() => result.current.commit());
    expect(h.textCommits).toEqual([{ id: 'a', text: 'one' }]);
    expect(h.runCommits[0].runs).toEqual([{ text: 'one', bold: true }]);
  });

  it('trims exactly one, so a deliberate trailing blank line survives', async () => {
    const h = makeRichHarness({ a: { text: 'one' } });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    // What the user typed ends in a newline, and the caret holder adds one
    // more on top of it.
    overlay.replaceChildren(
      document.createTextNode('one'),
      document.createElement('br'),
      document.createElement('br'),
    );
    await selectCharsAndSettle(overlay, 0, 3);
    act(() => result.current.applyStyleToSelection({ bold: true }));
    act(() => result.current.commit());
    expect(h.textCommits).toEqual([{ id: 'a', text: 'one\n' }]);
  });

  it('keeps a newline the user actually typed', () => {
    const h = makeRichHarness({ a: { text: 'a\nb', runs: [{ text: 'a\nb' }] } });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    appendChar(getOverlay(h.container)!, 'c');
    act(() => result.current.commit());
    expect(h.textCommits).toEqual([{ id: 'a', text: 'a\nbc' }]);
  });
});
