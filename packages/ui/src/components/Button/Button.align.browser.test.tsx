import '@weasel-js/theme/tokens.css';
import '@weasel-js/theme/faces.css';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import { Button } from '@weasel-js/ui/components/Button';
import { MenuButton } from '@weasel-js/ui/components/MenuButton';

// Where a face puts its capitals inside its line box is layout jsdom does not do. A button centers its glyphs and
// sets its label by cap height and baseline, so both land on its middle in every face.

afterEach(cleanup);

const FACES = ['Oswald', 'Inter'] as const;

/** How far `el`'s box center sits below `button`'s, in CSS px. */
function offset(el: Element, button: Element): number {
  const a = el.getBoundingClientRect();
  const b = button.getBoundingClientRect();
  return a.top + a.height / 2 - (b.top + b.height / 2);
}

/** How far the capitals of the text in `label` center below `button`'s middle, read from the label's baseline. */
function capOffset(label: HTMLElement, button: Element): number {
  const mark = document.createElement('span');
  mark.style.cssText = 'display:inline-block;width:0;height:0';
  label.appendChild(mark);
  const baseline = mark.getBoundingClientRect().bottom;
  mark.remove();
  const cs = getComputedStyle(label);
  const ctx = document.createElement('canvas').getContext('2d')!;
  ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const cap = ctx.measureText('H').actualBoundingBoxAscent;
  const b = button.getBoundingClientRect();
  return baseline - cap / 2 - (b.top + b.height / 2);
}

const glyph = <svg data-testid="glyph" width="12" height="12" viewBox="0 0 12 12" />;

describe.each(FACES)('in %s', (face) => {
  async function mount(node: React.ReactNode) {
    const { container } = render(<div style={{ ['--wzl-font-ui' as string]: face, fontFamily: face }}>{node}</div>);
    await document.fonts.load(`700 13px ${face}`);
    await document.fonts.ready;
    return container;
  }

  test.each(['xs', 'sm', 'md'] as const)('a %s button centers its glyph and its label on its middle', async (size) => {
    const container = await mount(<Button size={size} leadingIcon={glyph}>Add trial</Button>);
    const button = container.querySelector('button')!;
    const label = [...button.querySelectorAll('span')].find((s) => s.textContent === 'Add trial')!;
    expect(Math.abs(offset(container.querySelector('[data-testid="glyph"]')!, button))).toBeLessThanOrEqual(0.25);
    expect(Math.abs(capOffset(label, button))).toBeLessThanOrEqual(0.25);
  });

  test("a menu button centers its label and its caret on its middle", async () => {
    const container = await mount(
      <MenuButton aria-label="Add trial" label="Add trial…" items={[{ value: 'a', label: 'A' }]} onAction={() => {}} />,
    );
    const button = container.querySelector('button')!;
    const label = [...button.querySelectorAll('span')].find((s) => s.textContent === 'Add trial…')!;
    expect(Math.abs(offset(button.querySelector('svg')!, button))).toBeLessThanOrEqual(0.25);
    expect(Math.abs(capOffset(label, button))).toBeLessThanOrEqual(0.25);
  });
});
