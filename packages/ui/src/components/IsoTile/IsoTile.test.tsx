import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { IsoTile } from './IsoTile';
import { outlineOf, sideFaceOf, topFaceOf } from './isoGeometry';

const css = readFileSync(resolve(__dirname, 'IsoTile.module.css'), 'utf8');
const BOX = { x: 10, y: 20, width: 28, height: 7, depth: 8 };

const draw = (props: Partial<Parameters<typeof IsoTile>[0]> = {}) =>
  render(<svg><IsoTile {...BOX} {...props} /></svg>).container.querySelector('svg > g')!;

describe('isoGeometry', () => {
  it('recedes the top face up and to the right by the depth', () => {
    expect(topFaceOf(BOX)).toBe('10,20 18,12 46,12 38,20');
  });

  it('runs the side face down the front face\'s right edge', () => {
    expect(sideFaceOf(BOX)).toBe('38,20 46,12 46,19 38,27');
  });

  it('outlines all three faces as one hexagon', () => {
    expect(outlineOf(BOX)).toBe('10,27 10,20 18,12 46,12 46,19 38,27');
  });
});

describe('IsoTile', () => {
  it('draws a front, a top and a side, each a face', () => {
    const g = draw();
    expect(g.querySelector('rect')?.getAttribute('width')).toBe('28');
    expect([...g.querySelectorAll('polygon')].map((p) => p.getAttribute('points'))).toEqual([topFaceOf(BOX), sideFaceOf(BOX)]);
  });

  it('takes its tone as classes on the group, and a title as hover text', () => {
    const g = draw({ tone: 'warm extra', title: 'a tile' });
    expect(g.classList.contains('warm')).toBe(true);
    expect(g.classList.contains('extra')).toBe(true);
    expect(g.querySelector('title')?.textContent).toBe('a tile');
  });

  it('marks a traced tile with data-traced', () => {
    expect(draw({ traced: true }).hasAttribute('data-traced')).toBe(true);
    expect(draw().hasAttribute('data-traced')).toBe(false);
  });

  it('hears hover and clicks, and shows itself clickable only when it has a click handler', () => {
    const enter = vi.fn();
    const leave = vi.fn();
    const click = vi.fn();
    const g = draw({ onPointerEnter: enter, onPointerLeave: leave, onClick: click });
    fireEvent.pointerEnter(g);
    fireEvent.pointerLeave(g);
    fireEvent.click(g);
    expect([enter, leave, click].map((f) => f.mock.calls.length)).toEqual([1, 1, 1]);
    expect(g.getAttribute('class')).toMatch(/pickable/);
    expect(draw().getAttribute('class')).not.toMatch(/pickable/);
  });

  it('is a focusable button named by its title when it has a click handler, answering Enter and Space', () => {
    const click = vi.fn();
    const focus = vi.fn();
    const blur = vi.fn();
    const g = draw({ title: 'd1', onClick: click, onFocus: focus, onBlur: blur });
    expect(g.getAttribute('role')).toBe('button');
    expect(g.getAttribute('tabindex')).toBe('0');
    expect(g.getAttribute('aria-label')).toBe('d1');
    fireEvent.keyDown(g, { key: 'Enter' });
    fireEvent.keyDown(g, { key: ' ' });
    fireEvent.keyDown(g, { key: 'a' });
    fireEvent.focus(g);
    fireEvent.blur(g);
    expect([click, focus, blur].map((f) => f.mock.calls.length)).toEqual([2, 1, 1]);
    const plain = draw({ title: 'd1' });
    expect(plain.hasAttribute('role')).toBe(false);
    expect(plain.hasAttribute('tabindex')).toBe(false);
  });

  it('draws its children after the faces', () => {
    const g = render(<svg><IsoTile {...BOX}><circle data-testid="dot" r={1} /></IsoTile></svg>).container.querySelector('g')!;
    expect(g.lastElementChild?.tagName).toBe('circle');
  });

  it('fills every face from --tile-shown over --tile, mixed solid by default', () => {
    expect(css).toContain('fill: var(--tile-shown, var(--tile, color-mix(in srgb, var(--wzl-fg) 50%, var(--wzl-surface))));');
  });
});
