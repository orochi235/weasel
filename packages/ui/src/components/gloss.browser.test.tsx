import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { painted } from '../testing/paintedContrast';
import { Button } from './Button/Button';
import { ToggleBar } from './ToggleBar/ToggleBar';

// --wzl-gloss fades the glass on a boxed button and a selected segment through
// calc() and color-mix(), neither of which jsdom resolves.

afterEach(cleanup);

function Controls({ gloss }: { gloss?: number }) {
  return (
    // The token is the theme's; set here as a consumer or a theme would set it on a subtree.
    <div style={gloss === undefined ? undefined : { ['--wzl-gloss' as string]: gloss }}>
      <Button stance="confirm">Save</Button>
      <Button>Cancel</Button>
      <ToggleBar
        ariaLabel="View"
        items={[
          { value: 'tree', label: 'Tree' },
          { value: 'list', label: 'List' },
        ]}
        value="tree"
        onChange={() => {}}
      />
    </div>
  );
}

/** The alpha of every color in a computed shadow list. */
function alphas(shadow: string): number[] {
  return [...shadow.matchAll(/(rgba?|color)\(([^)]*)\)/g)].map(([, fn, args]) => {
    // `color(srgb r g b / a)` is how a color-mix() computes; its alpha follows the slash.
    if (fn === 'color') return args.includes('/') ? Number(args.split('/')[1]) : 1;
    const parts = args.split(/[\s,/]+/).filter(Boolean);
    return parts.length > 3 ? Number(parts[3]) : 1;
  });
}
const visible = (shadow: string) => alphas(shadow).filter((a) => a > 0).length;

/** The first color of an element's top background layer. */
function topFill(el: Element): string {
  const m = /gradient\(\s*((?:rgba?|color)\([^)]*\))/.exec(getComputedStyle(el).backgroundImage);
  if (!m) throw new Error(`no gradient on ${getComputedStyle(el).backgroundImage}`);
  return m[1];
}
const MAGENTA: [number, number, number] = [255, 0, 255];
const drawn = () => ({
  primary: screen.getByRole('button', { name: 'Save' }),
  secondary: screen.getByRole('button', { name: 'Cancel' }),
  selected: screen.getByRole('radio', { checked: true }),
});

test('the default theme draws primary and selected controls flat', () => {
  render(<Controls />);
  const { primary, secondary, selected } = drawn();
  const accent = painted(getComputedStyle(primary).getPropertyValue('--wzl-accent'), 'magenta');
  for (const el of [primary, selected]) {
    const cs = getComputedStyle(el);
    expect(painted(topFill(el), 'magenta')).toEqual(accent);
    expect(visible(cs.boxShadow)).toBe(0);
    expect(visible(cs.textShadow)).toBe(0);
    expect(getComputedStyle(el, '::before').opacity).toBe('0');
  }
  // A neutral fill needs an edge to be a button at all: one line, and no depth.
  expect(painted(topFill(secondary), 'magenta')).toEqual(painted(topFill(secondary), 'lime'));
  expect(visible(getComputedStyle(secondary).boxShadow)).toBe(1);
  expect(getComputedStyle(secondary, '::before').opacity).toBe('0');
});

test('a theme that sets --wzl-gloss to 1 gets the glass back', () => {
  render(<Controls gloss={1} />);
  const { primary, secondary, selected } = drawn();
  for (const el of [primary, secondary, selected]) {
    const cs = getComputedStyle(el);
    // The flat fill on top is fully clear, so the ramp under it is what shows.
    expect(painted(topFill(el), 'magenta')).toEqual(MAGENTA);
    expect(visible(cs.boxShadow)).toBeGreaterThanOrEqual(4);
    expect(getComputedStyle(el, '::before').opacity).toBe('1');
    expect(cs.backdropFilter).toBe('blur(6px) saturate(1.3)');
  }
  expect(getComputedStyle(primary).boxShadow).toContain('rgba(255, 255, 255, 0.42) 0px 1px 0px 0px inset');
});
