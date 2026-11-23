// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { isInControlWithin } from './controlTarget';
import { focusedControlOwnsKey } from './keyOwner';

afterEach(() => { document.body.innerHTML = ''; });

function pressIn(inner: string): { target: Element; host: Element } {
  document.body.innerHTML = `<div id="host">${inner}</div>`;
  return { target: document.getElementById('t')!, host: document.getElementById('host')! };
}

const KEY_ACTIVATED_ROLES = ['button', 'tab', 'option', 'radio', 'menuitemcheckbox', 'menuitemradio'];

describe('isInControlWithin', () => {
  it.each([
    '<button><i id="t"></i></button>',
    '<div contenteditable="true"><i id="t"></i></div>',
    '<div contenteditable="plaintext-only"><i id="t"></i></div>',
    '<details><summary><i id="t"></i></summary></details>',
    ...KEY_ACTIVATED_ROLES.map((r) => `<div role="${r}"><i id="t"></i></div>`),
  ])('is true for a press inside %s', (inner) => {
    const { target, host } = pressIn(inner);
    expect(isInControlWithin(target, host)).toBe(true);
  });

  it('is false for a press on plain content, or on the host itself', () => {
    const { target, host } = pressIn('<span><i id="t"></i></span>');
    expect(isInControlWithin(target, host)).toBe(false);
    host.setAttribute('role', 'button');
    expect(isInControlWithin(host, host)).toBe(false);
  });

  it.each(['<summary id="t"></summary>', ...KEY_ACTIVATED_ROLES.map((r) => `<div role="${r}" id="t"></div>`)])(
    'agrees with focusedControlOwnsKey that %s is a control',
    (html) => {
      const { target, host } = pressIn(html);
      const owns = [' ', 'Enter'].some((key) => {
        const e = new KeyboardEvent('keydown', { key, bubbles: true });
        target.dispatchEvent(e);
        return focusedControlOwnsKey(e);
      });
      expect(owns).toBe(true);
      expect(isInControlWithin(target, host)).toBe(true);
    },
  );
});

describe('isInControlWithin, in another document', () => {
  it('finds the control a target sits in', () => {
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);
    const doc = frame.contentDocument!;
    doc.body.innerHTML = '<div id="host"><button><i id="t"></i></button></div>';
    expect(isInControlWithin(doc.getElementById('t'), doc.getElementById('host')!)).toBe(true);
  });
});
