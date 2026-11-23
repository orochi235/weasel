// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { focusedControlOwnsKey, isEditableTarget, textOwnsChord } from './keyOwner';

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
    expect(isEditableTarget(el('<input type="bogus">'))).toBe(true);
    expect(isEditableTarget(el('<textarea></textarea>'))).toBe(true);
    expect(isEditableTarget(el('<div contenteditable="true"></div>'))).toBe(true);
    expect(isEditableTarget(el('<div contenteditable></div>'))).toBe(true);
    expect(isEditableTarget(el('<div contenteditable="plaintext-only"></div>'))).toBe(true);
  });

  it.each(['text', 'search', 'email', 'url', 'tel', 'password', 'number', 'date', 'datetime-local', 'month', 'week', 'time'])(
    'is true for an input of type %s',
    (type) => { expect(isEditableTarget(el(`<input type="${type}">`))).toBe(true); },
  );

  it.each(['checkbox', 'radio', 'button', 'submit', 'reset', 'image', 'range', 'color', 'file', 'hidden'])(
    'is false for an input of type %s, which takes no typed text',
    (type) => { expect(isEditableTarget(el(`<input type="${type}">`))).toBe(false); },
  );

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

  it('gives each control only the key that activates it: Space to a toggle, Enter to a link', () => {
    const spaceOnly = ['<input type="checkbox">', '<input type="radio">', '<div role="checkbox"></div>',
      '<div role="switch"></div>', '<div role="radio"></div>'];
    for (const html of spaceOnly) {
      expect(focusedControlOwnsKey(keyOn(el(html), ' ')), `Space on ${html}`).toBe(true);
      expect(focusedControlOwnsKey(keyOn(el(html), 'Enter')), `Enter on ${html}`).toBe(false);
    }
    for (const html of ['<a href="#x"></a>', '<span role="link"></span>']) {
      expect(focusedControlOwnsKey(keyOn(el(html), 'Enter')), `Enter on ${html}`).toBe(true);
      expect(focusedControlOwnsKey(keyOn(el(html), ' ')), `Space on ${html}`).toBe(false);
    }
  });

  it('gives Enter to a checkbox or radio in a form, which submits it', () => {
    const form = el('<form><input type="checkbox"><input type="radio"></form>');
    document.body.appendChild(form);
    for (const input of form.querySelectorAll('input')) {
      const e = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
      input.dispatchEvent(e);
      expect(focusedControlOwnsKey(e)).toBe(true);
    }
    form.remove();
  });

  it('gives Space and Enter to the inputs that open a picker or submit on them', () => {
    for (const type of ['file', 'color', 'image']) {
      for (const key of [' ', 'Enter']) {
        expect(focusedControlOwnsKey(keyOn(el(`<input type="${type}">`), key)), `${key} on ${type}`).toBe(true);
      }
    }
  });

  it('gives a select its type-ahead and its navigation keys', () => {
    expect(focusedControlOwnsKey(keyOn(select(), 'x'))).toBe(true);
    expect(focusedControlOwnsKey(keyOn(select(), 'X', { shiftKey: true }))).toBe(true);
    expect(focusedControlOwnsKey(keyOn(select(), 'ArrowDown'))).toBe(true);
    expect(focusedControlOwnsKey(keyOn(select(), 'Home'))).toBe(true);
    expect(focusedControlOwnsKey(keyOn(select(), '\u{10428}'))).toBe(true);
    expect(focusedControlOwnsKey(keyOn(select(), 'Escape'))).toBe(false);
  });

  it('gives a range its navigation keys and a radio its arrows, but no modifier chord or Delete', () => {
    const range = () => el('<input type="range">');
    const radio = () => el('<input type="radio">');
    expect(focusedControlOwnsKey(keyOn(range(), 'ArrowLeft'))).toBe(true);
    expect(focusedControlOwnsKey(keyOn(range(), 'PageUp'))).toBe(true);
    expect(focusedControlOwnsKey(keyOn(radio(), 'ArrowDown'))).toBe(true);
    expect(focusedControlOwnsKey(keyOn(radio(), 'Home'))).toBe(false);
    expect(focusedControlOwnsKey(keyOn(range(), 'Backspace'))).toBe(false);
    expect(focusedControlOwnsKey(keyOn(range(), 'z', { metaKey: true }))).toBe(false);
    expect(focusedControlOwnsKey(keyOn(el('<input type="checkbox">'), 'z', { metaKey: true }))).toBe(false);
  });

  it('leaves a select no claim on Delete, Escape, or a modifier chord', () => {
    expect(focusedControlOwnsKey(keyOn(select(), 'Delete'))).toBe(false);
    expect(focusedControlOwnsKey(keyOn(select(), 'Backspace'))).toBe(false);
    expect(focusedControlOwnsKey(keyOn(select(), 'Escape'))).toBe(false);
    expect(focusedControlOwnsKey(keyOn(select(), 'z', { metaKey: true }))).toBe(false);
    expect(focusedControlOwnsKey(keyOn(select(), 'z', { ctrlKey: true }))).toBe(false);
  });
});

describe('textOwnsChord', () => {
  const k = { ctrlKey: false, metaKey: false };
  it('gives a Mac its Ctrl chords, Cmd held or not deciding', () => {
    expect(textOwnsChord({ ...k, ctrlKey: true }, true)).toBe(true);
    expect(textOwnsChord({ ctrlKey: true, metaKey: true }, true)).toBe(false);
    expect(textOwnsChord({ ...k, metaKey: true }, true)).toBe(false);
    expect(textOwnsChord(k, true)).toBe(false);
  });

  it('gives the text no chord off a Mac, where Ctrl is mod', () => {
    expect(textOwnsChord({ ...k, ctrlKey: true }, false)).toBe(false);
  });
});
