// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { focusedControlOwnsKey, isEditableTarget } from './keyOwner';

function el(html: string): Element {
  const host = document.createElement('div');
  host.innerHTML = html;
  return host.firstElementChild!;
}

function keyOn(target: Element, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  document.body.appendChild(target);
  const e = new KeyboardEvent('keydown', { key, bubbles: true, ...init });
  target.dispatchEvent(e);
  target.remove();
  return e;
}

describe('isEditableTarget', () => {
  it('is true for the elements a person types text into', () => {
    expect(isEditableTarget(el('<input>'))).toBe(true);
    expect(isEditableTarget(el('<textarea></textarea>'))).toBe(true);
    expect(isEditableTarget(el('<div contenteditable="true"></div>'))).toBe(true);
    expect(isEditableTarget(el('<div contenteditable></div>'))).toBe(true);
  });

  it('is false for a select, which takes no text', () => {
    expect(isEditableTarget(el('<select><option>a</option></select>'))).toBe(false);
  });

  it('is false for a plain element and for no target', () => {
    expect(isEditableTarget(el('<div></div>'))).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});

describe('focusedControlOwnsKey', () => {
  const select = () => el('<select><option>a</option></select>');

  it('gives Space and Enter to a control they activate', () => {
    expect(focusedControlOwnsKey(keyOn(el('<button></button>'), ' '))).toBe(true);
    expect(focusedControlOwnsKey(keyOn(el('<button></button>'), 'Enter'))).toBe(true);
    expect(focusedControlOwnsKey(keyOn(el('<button></button>'), 'x'))).toBe(false);
  });

  it('gives a select its type-ahead and its navigation keys', () => {
    expect(focusedControlOwnsKey(keyOn(select(), 'x'))).toBe(true);
    expect(focusedControlOwnsKey(keyOn(select(), 'X', { shiftKey: true }))).toBe(true);
    expect(focusedControlOwnsKey(keyOn(select(), 'ArrowDown'))).toBe(true);
    expect(focusedControlOwnsKey(keyOn(select(), 'Home'))).toBe(true);
  });

  it('leaves a select no claim on Delete, Escape, or a modifier chord', () => {
    expect(focusedControlOwnsKey(keyOn(select(), 'Delete'))).toBe(false);
    expect(focusedControlOwnsKey(keyOn(select(), 'Backspace'))).toBe(false);
    expect(focusedControlOwnsKey(keyOn(select(), 'Escape'))).toBe(false);
    expect(focusedControlOwnsKey(keyOn(select(), 'z', { metaKey: true }))).toBe(false);
    expect(focusedControlOwnsKey(keyOn(select(), 'z', { ctrlKey: true }))).toBe(false);
  });
});
