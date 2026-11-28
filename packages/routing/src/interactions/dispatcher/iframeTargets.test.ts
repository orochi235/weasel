import { afterEach, describe, expect, it } from 'vitest';
import { holdSurface, landedNestedIn, pressedNestedIn } from './dispatchCore';
import { inModalOver } from './channels/modal';

/** A same-origin iframe's document, whose elements are another window's `Element`s. */
function frameDocument(): Document {
  const frame = document.createElement('iframe');
  document.body.appendChild(frame);
  return frame.contentDocument!;
}

afterEach(() => { document.body.replaceChildren(); });

describe('dispatcher targets in an iframe', () => {
  it('finds a nested pointer surface holding a press in an iframe document', () => {
    const doc = frameDocument();
    const outer = doc.createElement('div');
    const inner = doc.createElement('div');
    const target = doc.createElement('span');
    doc.body.append(outer);
    outer.append(inner);
    inner.append(target);
    const release = holdSurface(inner, { pointer: true });
    expect(pressedNestedIn(outer, target)).toBe(true);
    expect(landedNestedIn(outer, { target } as unknown as Event)).toBe(true);
    release();
  });

  it('keeps a key that lands in a modal dialog in an iframe document from the canvas behind it', () => {
    const doc = frameDocument();
    const dialog = doc.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    const input = doc.createElement('input');
    dialog.append(input);
    doc.body.append(dialog);
    expect(inModalOver(input, document.createElement('canvas'))).toBe(true);
  });
});
