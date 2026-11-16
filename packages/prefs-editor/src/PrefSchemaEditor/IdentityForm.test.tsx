import { cleanup, render } from '@testing-library/react';
import type { PrefGroup } from '@weasel-js/prefs';
import { afterEach, expect, it } from 'vitest';
import { IdentityForm } from './IdentityForm';

const original = HTMLElement.prototype.getBoundingClientRect;
afterEach(() => {
  HTMLElement.prototype.getBoundingClientRect = original;
  cleanup();
});

const schema: PrefGroup = {
  name: '',
  children: {
    name: { kind: 'number', name: 'Name', description: '', default: 1 },
    description: { kind: 'number', name: 'Description', description: '', default: 2 },
  },
};

it('sizes the glyph in its own px when an ancestor draws the form at twice its size', () => {
  HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
    if (this.dataset.testHost !== undefined) return DOMRect.fromRect({ x: 0, y: 0, width: 400, height: 200 });
    const path = this.closest('[data-pref-path]')?.getAttribute('data-pref-path');
    if (path === 'name') return DOMRect.fromRect({ x: 0, y: 0, width: 380, height: 60 });
    if (path === 'description') return DOMRect.fromRect({ x: 0, y: 60, width: 380, height: 40 });
    return DOMRect.fromRect({ x: 0, y: 0, width: 0, height: 0 });
  };
  const { container, rerender } = render(<IdentityForm schema={schema} onChange={() => {}} icon={<b>i</b>} />);
  const host = container.firstElementChild as HTMLElement;
  host.dataset.testHost = '';
  Object.defineProperty(host, 'offsetWidth', { value: 200 });
  Object.defineProperty(host, 'offsetHeight', { value: 100 });
  rerender(<IdentityForm schema={{ ...schema }} onChange={() => {}} icon={<b>i</b>} />);
  const glyph = container.querySelector<HTMLElement>('[aria-hidden="true"]')!;
  expect([glyph.style.getPropertyValue('--identity-tall'), glyph.style.getPropertyValue('--identity-end')]).toEqual(['50px', '10px']);
});
