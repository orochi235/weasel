import '@weasel-js/theme/tokens.css';
import { cleanup, render } from '@testing-library/react';
import { percent, tag, unit } from '@weasel-js/quantity';
import { afterEach, expect, it } from 'vitest';
import { QuantityText } from './QuantityText';

// What a part is drawn in is the cascade's, and whether the spoken copy takes room is layout.

afterEach(cleanup);

const part = (root: Element, type: string) => getComputedStyle(root.querySelector(`[data-part="${type}"]`)!);

it('dims a unit, a percent sign, and a label, and leaves the number in the text color', () => {
  const { container } = render(
    <div>
      <QuantityText vector={[tag(2, unit('ft')), tag(0.5, percent())]} labels={['w', 'h']} />
    </div>,
  );
  const root = container.firstElementChild!;
  const fg = getComputedStyle(root).color;
  const probe = document.createElement('span');
  probe.style.color = 'var(--wzl-fg-muted)';
  root.append(probe);
  const muted = getComputedStyle(probe).color;
  expect(muted).not.toBe(fg);
  expect(part(root, 'number').color).toBe(fg);
  for (const type of ['unit', 'percentSign', 'label']) expect(part(root, type).color).toBe(muted);
  expect(getComputedStyle(root.firstElementChild!).fontVariantNumeric).toBe('tabular-nums');
});

it('keeps the spoken copy of a range out of the line it sits in', () => {
  const alone = render(<QuantityText value={2} />);
  const plain = alone.container.firstElementChild!.getBoundingClientRect();
  const { container } = render(<QuantityText range={[1, 2]} separator="" />);
  const root = container.firstElementChild!;
  const [form, spoken] = root.children;
  expect(spoken!.textContent).toBe('1 to 2');
  expect(root.getBoundingClientRect().width).toBeCloseTo(form!.getBoundingClientRect().width, 1);
  expect(root.getBoundingClientRect().height).toBeCloseTo(plain.height, 1);
  expect(spoken!.getBoundingClientRect().width).toBeLessThanOrEqual(1);
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(document.documentElement.clientWidth);
});
