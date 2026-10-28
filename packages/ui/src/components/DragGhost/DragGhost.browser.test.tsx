import '@weasel-js/theme/tokens.css';
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { DragGhost } from './DragGhost';

afterEach(cleanup);

/** A themed host pushed off the viewport's corner by `hostStyle`, with a ghost asked for at (120, 90). */
function ghostIn(hostStyle: string, width?: number): DOMRect {
  const host = document.createElement('div');
  host.setAttribute('data-wzl-theme', 'weasel');
  host.setAttribute('style', `position: absolute; left: 50px; top: 30px; width: 400px; height: 300px; ${hostStyle}`);
  document.body.append(host);
  const from = document.createElement('i');
  host.append(from);
  render(
    <DragGhost at={{ left: 120, top: 90, ...(width === undefined ? {} : { width }) }} from={from}>
      <span>Item</span>
    </DragGhost>,
  );
  const rect = host.querySelector('[aria-hidden="true"]')!.getBoundingClientRect();
  host.remove();
  return rect;
}

test('lands on the client point whether or not its host contains fixed boxes', () => {
  for (const hostStyle of ['', 'transform: translateX(7px);', 'contain: layout;', 'filter: blur(0);']) {
    const rect = ghostIn(hostStyle, 80);
    expect([hostStyle, Math.round(rect.left), Math.round(rect.top)]).toEqual([hostStyle, 120, 90]);
  }
});

test('is as wide as what it holds when given no width', () => {
  const own = ghostIn('').width;
  expect(own).toBeGreaterThan(0);
  expect(own).toBeLessThan(ghostIn('', 200).width);
});

test('centers itself on the client point when asked, with no surface under a bare one', () => {
  const host = document.createElement('div');
  host.setAttribute('data-wzl-theme', 'weasel');
  document.body.append(host);
  const from = document.createElement('i');
  host.append(from);
  render(
    <DragGhost at={{ left: 120, top: 90 }} from={from} centered bare>
      <svg width={40} height={20} />
    </DragGhost>,
  );
  const ghost = host.querySelector('[aria-hidden="true"]')!;
  const rect = ghost.getBoundingClientRect();
  const shadow = getComputedStyle(ghost).boxShadow;
  host.remove();
  expect([Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)]).toEqual([120, 90]);
  expect(shadow).toBe('none');
});
