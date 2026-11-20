// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { isInControlWithin } from './controlTarget';

afterEach(() => { document.body.innerHTML = ''; });

function pressIn(inner: string): { target: Element; host: Element } {
  document.body.innerHTML = `<div id="host">${inner}</div>`;
  return { target: document.getElementById('t')!, host: document.getElementById('host')! };
}

describe('isInControlWithin', () => {
  it.each([
    '<button><i id="t"></i></button>',
    '<div contenteditable="true"><i id="t"></i></div>',
    '<div contenteditable="plaintext-only"><i id="t"></i></div>',
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
});
