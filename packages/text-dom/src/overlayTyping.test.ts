import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RunStylePatch } from '@weasel-js/text';
import { DEFAULT_TEXT_STYLE } from '@weasel-js/text';
import { domToRuns, runsToDom } from './domRuns';
import { typingHandlers, type TypingHost } from './overlayTyping';

function mount(pending: RunStylePatch = {}) {
  const overlay = document.createElement('div');
  overlay.setAttribute('contenteditable', 'true');
  document.body.appendChild(overlay);
  const host: TypingHost = {
    pending: () => pending,
    base: () => DEFAULT_TEXT_STYLE,
    lastRange: () => null,
    onWritten: vi.fn(),
    onEdited: vi.fn(),
    history: { before: vi.fn(), after: vi.fn(), seal: vi.fn(), undo: vi.fn(), redo: vi.fn() },
  };
  return { overlay, host, ...typingHandlers(overlay, host) };
}

function insertText(data: string, targetRange?: StaticRange): InputEvent {
  const ev = new InputEvent('beforeinput', { inputType: 'insertText', data, cancelable: true });
  if (targetRange) ev.getTargetRanges = () => [targetRange];
  return ev;
}

function caretAt(node: Node, offset: number): void {
  window.getSelection()!.collapse(node, offset);
}

describe('typingHandlers', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('leaves a character typed inside a text node to the browser', () => {
    const { overlay, host, onBeforeInput } = mount();
    runsToDom([{ text: 'ab', bold: true }], overlay);
    caretAt(overlay.firstChild!.firstChild!, 1);
    const ev = insertText('X');
    onBeforeInput(ev);
    expect(ev.defaultPrevented).toBe(false);
    expect(host.onEdited).not.toHaveBeenCalled();
  });

  it('gives a character typed between two run spans the run before it, as the caret reports, and the caret after it', () => {
    const { overlay, host, onBeforeInput } = mount();
    runsToDom([{ text: 'a', bold: true }, { text: 'b' }], overlay);
    caretAt(overlay, 1);
    const ev = insertText('X');
    onBeforeInput(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(domToRuns(overlay)).toEqual([{ text: 'aX', bold: true }, { text: 'b' }]);
    const sel = window.getSelection()!;
    expect(sel.anchorNode!.nodeType).toBe(Node.TEXT_NODE);
    expect(sel.anchorNode!.parentElement!.closest('[data-run]')).toBe(overlay.children[0]);
    expect(host.onWritten).toHaveBeenCalledWith({ start: 2, end: 2 });
    expect(host.onEdited).toHaveBeenCalledTimes(1);
  });

  it('gives a character typed before the first run span that run', () => {
    const { overlay, onBeforeInput } = mount();
    runsToDom([{ text: 'a', italic: true }, { text: 'b' }], overlay);
    caretAt(overlay, 0);
    onBeforeInput(insertText('X'));
    expect(domToRuns(overlay)).toEqual([{ text: 'Xa', italic: true }, { text: 'b' }]);
  });

  it('writes an armed style into a run of its own', () => {
    const { overlay, host, onBeforeInput } = mount({ bold: true });
    runsToDom([{ text: 'ab' }], overlay);
    caretAt(overlay.firstChild!.firstChild!, 2);
    const ev = insertText('X');
    onBeforeInput(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(domToRuns(overlay)).toEqual([{ text: 'ab' }, { text: 'X', bold: true }]);
    expect(host.onWritten).toHaveBeenCalledWith({ start: 3, end: 3 });
    expect(host.onEdited).toHaveBeenCalledTimes(1);
  });

  it('keeps the styling of the run an armed style types into', () => {
    const { overlay, onBeforeInput } = mount({ bold: true });
    runsToDom([{ text: 'ab', italic: true, fontSize: 30 }], overlay);
    caretAt(overlay.firstChild!.firstChild!, 2);
    onBeforeInput(insertText('X'));
    expect(domToRuns(overlay)).toEqual([
      { text: 'ab', italic: true, fontSize: 30 },
      { text: 'X', italic: true, fontSize: 30, bold: true },
    ]);
  });

  it('takes off a flag an armed false names, keeping the rest of the run', () => {
    const { overlay, onBeforeInput } = mount({ italic: false });
    runsToDom([{ text: 'ab', italic: true, underline: true }], overlay);
    caretAt(overlay.firstChild!.firstChild!, 2);
    onBeforeInput(insertText('X'));
    expect(domToRuns(overlay)).toEqual([
      { text: 'ab', italic: true, underline: true },
      { text: 'X', underline: true },
    ]);
  });

  // The double-space period and a text replacement arrive as `insertText`
  // over a range that is not the caret.
  it('leaves input that names its own range to the browser, an armed style or not', () => {
    for (const pending of [{}, { bold: true }]) {
      const { overlay, onBeforeInput } = mount(pending);
      runsToDom([{ text: 'ab ' }], overlay);
      const text = overlay.firstChild!.firstChild!;
      caretAt(text, 3);
      const ev = insertText('. ', new StaticRange({ startContainer: text, startOffset: 2, endContainer: text, endOffset: 3 }));
      onBeforeInput(ev);
      expect(ev.defaultPrevented).toBe(false);
      overlay.remove();
    }
  });

  it('reports an edit the browser made', () => {
    const { overlay, host, onInput } = mount();
    onInput(new InputEvent('input', { inputType: 'insertText', data: 'x' }));
    expect(host.onEdited).toHaveBeenCalledTimes(1);
    overlay.remove();
  });
});

/** A composition the browser types into the text node holding the caret, as an IME does. */
function compose(
  handlers: ReturnType<typeof mount>, node: Text, offset: number, data: string,
): void {
  caretAt(node, offset);
  handlers.onCompositionStart();
  node.insertData(offset, data);
  caretAt(node, offset + data.length);
  handlers.onInput(new InputEvent('input', { inputType: 'insertCompositionText', data, isComposing: true }));
  handlers.onCompositionEnd();
}

describe('typingHandlers: a composition', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('gives an armed style to the text an input method commits', () => {
    const h = mount({ bold: true });
    runsToDom([{ text: 'ab', italic: true }], h.overlay);
    compose(h, h.overlay.firstChild!.firstChild as Text, 2, 'かな');
    expect(domToRuns(h.overlay)).toEqual([
      { text: 'ab', italic: true },
      { text: 'かな', italic: true, bold: true },
    ]);
    expect(h.host.onWritten).toHaveBeenCalledWith({ start: 4, end: 4 });
  });

  it('leaves a composition with nothing armed as the browser typed it', () => {
    const h = mount();
    runsToDom([{ text: 'ab', italic: true }], h.overlay);
    compose(h, h.overlay.firstChild!.firstChild as Text, 1, 'か');
    expect(domToRuns(h.overlay)).toEqual([{ text: 'aかb', italic: true }]);
    expect(h.host.onWritten).not.toHaveBeenCalled();
  });

  it('puts small-caps letters in their pieces once the composition ends', () => {
    const h = mount();
    runsToDom([{ text: 'A', fontVariantCaps: 'small-caps' }], h.overlay);
    const text = h.overlay.firstChild!.firstChild as Text;
    compose(h, text, 1, 'b');
    expect(h.overlay.querySelector('[data-small-caps]')?.textContent).toBe('b');
  });
});

function paste(inputType: string, data: Record<string, string> | null, targetRange?: StaticRange): InputEvent {
  const ev = new InputEvent('beforeinput', { inputType, cancelable: true });
  Object.defineProperty(ev, 'dataTransfer', {
    value: data && { getData: (type: string) => data[type] ?? '' },
  });
  if (targetRange) ev.getTargetRanges = () => [targetRange];
  return ev;
}

describe('typingHandlers: a paste or a drop', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('writes pasted markup as runs styled like the run they join, emphasis added', () => {
    const { overlay, host, onBeforeInput } = mount();
    runsToDom([{ text: 'ab', fontSize: 30, fontWeight: 300 }, { text: 'cd' }], overlay);
    caretAt(overlay.firstChild!.firstChild!, 1);
    const ev = paste('insertFromPaste', { 'text/html': '<p style="font-size: 9px">x <b>y</b></p><p>z</p>' });
    onBeforeInput(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(domToRuns(overlay)).toEqual([
      { text: 'ax ', fontSize: 30, fontWeight: 300 },
      { text: 'y', fontSize: 30, bold: true },
      { text: '\nzb', fontSize: 30, fontWeight: 300 },
      { text: 'cd' },
    ]);
    expect(overlay.querySelector('p, b')).toBeNull();
    expect(host.onWritten).toHaveBeenCalledWith({ start: 6, end: 6 });
    expect(host.onEdited).toHaveBeenCalledTimes(1);
    expect(window.getSelection()!.getRangeAt(0).collapsed).toBe(true);
  });

  it('replaces the selection, in the style of its first character', () => {
    const { overlay, onBeforeInput } = mount();
    runsToDom([{ text: 'ab' }, { text: 'cd', italic: true }], overlay);
    const sel = window.getSelection()!;
    sel.setBaseAndExtent(overlay.children[1].firstChild!, 0, overlay.children[1].firstChild!, 2);
    onBeforeInput(paste('insertFromPaste', { 'text/plain': 'X\r\nY' }));
    expect(domToRuns(overlay)).toEqual([{ text: 'ab' }, { text: 'X\nY', italic: true }]);
  });

  it('drops at the range the event names, not at the selection', () => {
    const { overlay, onBeforeInput } = mount();
    runsToDom([{ text: 'abcd' }], overlay);
    const text = overlay.firstChild!.firstChild!;
    caretAt(text, 0);
    const at = new StaticRange({ startContainer: text, startOffset: 3, endContainer: text, endOffset: 3 });
    onBeforeInput(paste('insertFromDrop', { 'text/plain': 'X' }, at));
    expect(domToRuns(overlay)).toEqual([{ text: 'abcXd' }]);
  });

  it('gives an armed style to what is pasted', () => {
    const { overlay, onBeforeInput } = mount({ underline: true });
    runsToDom([{ text: 'ab' }], overlay);
    caretAt(overlay.firstChild!.firstChild!, 2);
    onBeforeInput(paste('insertFromPaste', { 'text/plain': 'X' }));
    expect(domToRuns(overlay)).toEqual([{ text: 'ab' }, { text: 'X', underline: true }]);
  });

  it('inserts nothing for a clipboard with no text, and leaves an event with no data to the browser', () => {
    const { overlay, host, onBeforeInput } = mount();
    runsToDom([{ text: 'ab' }], overlay);
    caretAt(overlay.firstChild!.firstChild!, 1);
    const image = paste('insertFromPaste', { 'text/html': '<img src="x.png">' });
    onBeforeInput(image);
    expect(image.defaultPrevented).toBe(true);
    expect(domToRuns(overlay)).toEqual([{ text: 'ab' }]);
    expect(host.onEdited).not.toHaveBeenCalled();
    const bare = paste('insertFromPaste', null);
    onBeforeInput(bare);
    expect(bare.defaultPrevented).toBe(false);
  });
});
