import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type Browser, unringed } from './a11y.ring';

/** Tab moves through `order`, as the page's tab order would, then leaves the document. */
const keyboard = (order: () => HTMLElement[]): Browser => ({
  page: { screenshot: async () => 'the same pixels focused or not' },
  userEvent: {
    keyboard: async () => {
      const stops = order();
      const at = stops.indexOf(document.activeElement as HTMLElement);
      const next = stops[at + 1];
      if (next) next.focus();
      else (document.activeElement as HTMLElement | null)?.blur();
    },
  },
});

const button = (name: string, ringed: boolean) => {
  const el = document.createElement('button');
  el.textContent = name;
  // An unringed one takes away the outline jsdom's own sheet draws on focus, as a story's styles would.
  el.style.outlineStyle = 'none';
  if (ringed) {
    el.addEventListener('focus', () => { el.style.outlineStyle = 'solid'; });
    el.addEventListener('blur', () => { el.style.outlineStyle = 'none'; });
  }
  return el;
};

let host: HTMLElement;
const proto = Element.prototype as { getAnimations?: () => Animation[] };
const hadAnimations = 'getAnimations' in proto;

beforeEach(() => {
  if (!hadAnimations) proto.getAnimations = () => [];
  host = document.createElement('div');
  document.body.append(host);
});

afterEach(() => {
  if (!hadAnimations) delete proto.getAnimations;
  document.body.replaceChildren();
});

describe('unringed', () => {
  it('judges a stop it could not list before tabbing', async () => {
    const ringed = button('ringed', true);
    host.append(ringed);
    let late: HTMLElement | null = null;
    // A stop that appears once the first is focused, as a revealed control does.
    ringed.addEventListener('focus', () => { late ??= host.appendChild(button('late', false)); });
    const start = () => [...document.querySelectorAll<HTMLElement>('button')];
    expect(await unringed(host, keyboard(() => [...start(), ...(late ? [late] : [])]))).toEqual(['<button> "late"']);
  });

  it('carries on past a stop outside the host to the host stops after it', async () => {
    const first = button('first', true);
    const last = button('last', false);
    host.append(first, last);
    const portal = document.body.appendChild(button('portal', true));
    const start = () => document.querySelector<HTMLElement>('button')!;
    expect(await unringed(host, keyboard(() => [start(), first, portal, last]))).toEqual(['<button> "last"']);
  });
});
