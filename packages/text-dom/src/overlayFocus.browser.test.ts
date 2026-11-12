/**
 * Which focused chrome control keeps focus when a styling lands, against a real browser's focus and
 * contenteditable: one the user types text into keeps it, and a checkbox, a slider or a button hands it back.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { restoreOverlayFocus } from './overlaySelection';

let made: HTMLElement[] = [];
afterEach(() => {
  for (const el of made) el.remove();
  made = [];
});

function add<T extends HTMLElement>(el: T): T {
  document.body.appendChild(el);
  made.push(el);
  return el;
}

function overlay(): HTMLDivElement {
  const el = add(document.createElement('div'));
  el.contentEditable = 'true';
  el.textContent = 'abcd';
  return el;
}

function input(type: string): HTMLInputElement {
  const el = add(document.createElement('input'));
  el.type = type;
  return el;
}

describe('restoreOverlayFocus', () => {
  it.each(['checkbox', 'range', 'button'])('hands focus back from a %s input', (type) => {
    const o = overlay();
    input(type).focus();
    restoreOverlayFocus(o, { start: 1, end: 3 });
    expect(document.activeElement).toBe(o);
  });

  it.each(['text', 'number'])('leaves focus in a %s field the user is typing in', (type) => {
    const o = overlay();
    const field = input(type);
    field.focus();
    restoreOverlayFocus(o, { start: 1, end: 3 });
    expect(document.activeElement).toBe(field);
  });
});
