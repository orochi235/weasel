import { act } from '@testing-library/react';
import type { UseTextEditOptions } from '../textEditTypes';
import type { StyledRun } from '@weasel-js/text';
import { resolveScreenLength } from '@weasel-js/paint';
import type { TextStyle } from '@weasel-js/text';

export function makeHarness(initial: Record<string, string>) {
  const texts = { ...initial };
  const container = document.createElement('div');
  document.body.appendChild(container);
  const commits: Array<{ id: string; text: string }> = [];
  const opts: UseTextEditOptions = {
    container,
    getText: (id) => texts[id] ?? '',
    getStyle: () => ({ fontSize: 16 }),
    getScreenPose: (id) => (id in texts ? { x: 0, y: 0, width: 200, height: 40, fontSize: 16 } : null),
    setText: (id, text) => {
      texts[id] = text;
      commits.push({ id, text });
    },
  };
  return { opts, container, commits, texts };
}

export function getOverlay(container: HTMLElement): HTMLDivElement | null {
  return container.querySelector('div[contenteditable="true"]');
}

/** A keystroke at the end of the text, so the commit has something to write. */
export function appendChar(overlay: HTMLElement, ch: string): void {
  const walker = document.createTreeWalker(overlay, NodeFilter.SHOW_TEXT);
  let last: Text | null = null;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) last = n as Text;
  if (last) last.data += ch;
  else overlay.appendChild(document.createTextNode(ch));
}

export function makeRichHarness(initial: Record<string, { text: string; runs?: StyledRun[] }>) {
  const data = { ...initial };
  const container = document.createElement('div');
  document.body.appendChild(container);
  const textCommits: Array<{ id: string; text: string }> = [];
  const runCommits: Array<{ id: string; runs: StyledRun[] }> = [];
  const opts: UseTextEditOptions = {
    container,
    getText: (id) => data[id]?.text ?? '',
    getStyle: () => ({ fontSize: 16 }),
    getScreenPose: (id) => (id in data ? { x: 0, y: 0, width: 200, height: 40, fontSize: 16 } : null),
    setText: (id, text) => { data[id] = { ...data[id], text }; textCommits.push({ id, text }); },
    getRuns: (id) => data[id]?.runs,
    setRuns: (id, runs) => { data[id] = { ...data[id], runs }; runCommits.push({ id, runs }); },
  };
  return { opts, container, data, textCommits, runCommits };
}

export function selectChars(overlay: HTMLElement, start: number, end: number): void {
  const range = document.createRange();
  function findPos(target: number): { node: Node; offset: number } | null {
    let remaining = target;
    const walker = document.createTreeWalker(overlay, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode() as Text | null;
    while (node) {
      if (remaining <= node.data.length) return { node, offset: remaining };
      remaining -= node.data.length;
      node = walker.nextNode() as Text | null;
    }
    return null;
  }
  const a = findPos(start)!;
  const b = findPos(end)!;
  range.setStart(a.node, a.offset);
  range.setEnd(b.node, b.offset);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

export function pressKey(
  overlay: HTMLElement,
  key: string,
  mods: { meta?: boolean; ctrl?: boolean; shift?: boolean } = {},
): KeyboardEvent {
  const ev = new KeyboardEvent('keydown', {
    key,
    metaKey: mods.meta ?? false,
    ctrlKey: mods.ctrl ?? false,
    shiftKey: mods.shift ?? false,
    bubbles: true,
    cancelable: true,
  });
  overlay.dispatchEvent(ev);
  return ev;
}

export function placeCaretAtChar(overlay: HTMLElement, charOffset: number): void {
  const range = document.createRange();
  let remaining = charOffset;
  const walker = document.createTreeWalker(overlay, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode() as Text | null;
  while (node) {
    if (remaining <= node.data.length) {
      range.setStart(node, remaining);
      range.setEnd(node, remaining);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      return;
    }
    remaining -= node.data.length;
    node = walker.nextNode() as Text | null;
  }
}

// jsdom implements no contenteditable editing, so it never fires `beforeinput`
// on its own, and does nothing for one the hook leaves to the browser. This
// stands in for that default: the text goes into the caret's text node and an
// `input` follows. `overlayTyping.browser.test.tsx` types with real keys.
export function dispatchBeforeInput(overlay: HTMLElement, data: string): void {
  const ev = new InputEvent('beforeinput', {
    inputType: 'insertText',
    data,
    bubbles: true,
    cancelable: true,
  });
  if (!overlay.dispatchEvent(ev)) return;
  const range = window.getSelection()!.getRangeAt(0);
  const node = range.startContainer as Text;
  node.insertData(range.startOffset, data);
  window.getSelection()!.collapse(node, range.startOffset + data.length);
  overlay.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data, bubbles: true }));
}

/** Rich harness with a caller-supplied node style and screen font size, so
 *  the world→screen factor (`pose.fontSize / style.fontSize`) is testable. */
export function makeTrackingHarness(
  runs: StyledRun[],
  style: TextStyle,
  screenFontSize = resolveScreenLength(style.fontSize ?? 16, 1),
) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const runCommits: Array<{ id: string; runs: StyledRun[] }> = [];
  const opts: UseTextEditOptions = {
    container,
    getText: () => runs.map((r) => r.text).join(''),
    getStyle: () => style,
    getScreenPose: () => ({ x: 0, y: 0, width: 200, height: 40, fontSize: screenFontSize }),
    setText: () => {},
    getRuns: () => runs,
    setRuns: (id, next) => { runCommits.push({ id, runs: next }); },
  };
  return { opts, container, runCommits };
}

/**
 * `selectionchange` is fired from a task, not synchronously — jsdom copies the
 * browser here — so a test that moves the caret has to let a macrotask run
 * before the hook has observed it. Anything the hook itself writes (its own
 * style application, edit start) syncs synchronously and needs no flush.
 */
export async function selectCharsAndSettle(overlay: HTMLElement, start: number, end: number): Promise<void> {
  await act(async () => {
    selectChars(overlay, start, end);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

export async function placeCaretAndSettle(overlay: HTMLElement, charOffset: number): Promise<void> {
  await act(async () => {
    placeCaretAtChar(overlay, charOffset);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

/** Replace a plain-text overlay's contents with `text`, standing in for an edit. */
export function seedPlainOverlay(overlay: HTMLElement, text: string): void {
  overlay.replaceChildren(document.createTextNode(text));
}
