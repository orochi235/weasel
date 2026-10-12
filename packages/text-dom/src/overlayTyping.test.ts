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
    onPendingTyped: vi.fn(),
    onEdited: vi.fn(),
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

  it('gives a character typed between two run spans a text node of its own, and the caret to it', () => {
    const { overlay, host, onBeforeInput } = mount();
    runsToDom([{ text: 'a', bold: true }, { text: 'b' }], overlay);
    caretAt(overlay, 1);
    const ev = insertText('X');
    onBeforeInput(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(domToRuns(overlay)).toEqual([{ text: 'a', bold: true }, { text: 'Xb' }]);
    const sel = window.getSelection()!;
    expect(sel.anchorNode).toBe(overlay.childNodes[1]);
    expect(sel.anchorNode!.nodeType).toBe(Node.TEXT_NODE);
    expect(sel.anchorOffset).toBe(1);
    expect(host.onEdited).toHaveBeenCalledTimes(1);
  });

  it('writes an armed style into a run of its own', () => {
    const { overlay, host, onBeforeInput } = mount({ bold: true });
    runsToDom([{ text: 'ab' }], overlay);
    caretAt(overlay.firstChild!.firstChild!, 2);
    const ev = insertText('X');
    onBeforeInput(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(domToRuns(overlay)).toEqual([{ text: 'ab' }, { text: 'X', bold: true }]);
    expect(host.onPendingTyped).toHaveBeenCalledWith(3);
    expect(host.onEdited).toHaveBeenCalledTimes(1);
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
