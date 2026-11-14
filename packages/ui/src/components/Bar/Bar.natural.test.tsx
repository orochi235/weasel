import { afterAll, afterEach, beforeAll, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Bar } from './Bar';

// jsdom lays nothing out: each item is 30 px long, the lead 20 px, and the bar 0 px, so its line holds nothing.
const realRect = Element.prototype.getBoundingClientRect;
beforeAll(() => {
  Element.prototype.getBoundingClientRect = function box(this: Element) {
    const width = this.matches('[data-bar-lead]') ? 20 : this.matches('[data-bar-item]') ? 30 : 0;
    return { x: 0, y: 0, left: 0, top: 0, right: width, bottom: 20, width, height: 20, toJSON: () => {} } as DOMRect;
  };
});
afterAll(() => {
  Element.prototype.getBoundingClientRect = realRect;
});
afterEach(cleanup);

const cells = ['a', 'b', 'c'].map((key) => <button key={key} type="button">{key}</button>);

it('asks for the length that holds its lead and every item, though its line holds fewer', () => {
  render(<Bar label="Tools" lead="label" overflow="menu">{cells}</Bar>);
  const bar = screen.getByRole('toolbar', { name: 'Tools' });
  expect(screen.getByRole('button', { name: 'More' })).toBeInTheDocument();
  expect(bar.style.getPropertyValue('--bar-natural')).toBe('110px');
});

it('asks for nothing when it scrolls instead', () => {
  render(<Bar label="Tools" lead="label">{cells}</Bar>);
  expect(screen.getByRole('toolbar', { name: 'Tools' }).style.getPropertyValue('--bar-natural')).toBe('');
});
