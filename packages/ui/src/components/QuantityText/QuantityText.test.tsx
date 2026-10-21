import { cleanup, render } from '@testing-library/react';
import { decimal, fraction, present, presentRange, presentVector, tag, unit } from '@weasel-js/quantity';
import { afterEach, expect, it } from 'vitest';
import { QuantityText } from './QuantityText';

afterEach(cleanup);

/** The element holding the HTML form, and the words a screen reader gets where they differ from it. */
function drawn(container: HTMLElement): { form: Element; spoken: string | undefined } {
  const [form, spoken] = container.firstElementChild!.children;
  return { form: form!, spoken: spoken?.textContent ?? undefined };
}

it('draws one quantity as its HTML form, with no second copy where the text reads as it is', () => {
  const { container } = render(<QuantityText value={2.5} display={decimal()} />);
  const { form, spoken } = drawn(container);
  expect(form.innerHTML).toBe(present(2.5, decimal()).html);
  expect(spoken).toBeUndefined();
  expect(form.hasAttribute('aria-hidden')).toBe(false);
});

it('marks the unit of a value that has one, and reads the unit out in full', () => {
  const { container } = render(<QuantityText value={tag(2, unit('ft'))} />);
  const { form, spoken } = drawn(container);
  expect(form.innerHTML).toBe(present(tag(2, unit('ft'))).html);
  expect(form.querySelector('[data-part="unit"]')?.textContent).toBe('ft');
  expect(form.getAttribute('aria-hidden')).toBe('true');
  expect(spoken).toBe('2 feet');
});

it('draws a range as one composite, and hands a reader its spoken form in place of the dash', () => {
  const { container } = render(<QuantityText range={[tag(1 / 64, fraction()), tag(1 / 2, fraction())]} />);
  const { form, spoken } = drawn(container);
  expect(form.innerHTML).toBe(presentRange(tag(1 / 64, fraction()), tag(1 / 2, fraction())).html);
  expect(form.querySelector('[data-composite="range"]')?.textContent).toBe('1/64–1/2');
  expect(form.getAttribute('aria-hidden')).toBe('true');
  expect(spoken).toBe('1 over 64 to 1 over 2');
});

it('draws a vector with a label before each member, under the fallback display', () => {
  const { container } = render(<QuantityText vector={[10, 20.5]} labels={['x', 'y']} display={decimal()} />);
  const { form } = drawn(container);
  expect(form.innerHTML).toBe(presentVector([10, 20.5], decimal(), { labels: ['x', 'y'] }).html);
  expect(form.textContent).toBe('x 10, y 20.5');
  expect([...form.querySelectorAll('[data-part="label"]')].map((el) => el.textContent)).toEqual(['x', 'y']);
  expect([...form.querySelectorAll('data')].map((el) => el.getAttribute('value'))).toEqual(['10', '20.5']);
});

it('takes a separator of its own for a range and for a vector', () => {
  const range = render(<QuantityText range={[1, 2]} separator=" to " />);
  expect(drawn(range.container).form.textContent).toBe('1 to 2');
  const vector = render(<QuantityText vector={[1, 2]} separator=" × " />);
  expect(drawn(vector.container).form.textContent).toBe('1 × 2');
});

it('draws a label as text, whatever is in it', () => {
  const { container } = render(<QuantityText vector={[1]} labels={['<b>x</b>']} />);
  const { form } = drawn(container);
  expect(form.querySelector('b')).toBeNull();
  expect(form.querySelector('[data-part="label"]')?.textContent).toBe('<b>x</b>');
});

it('draws only the HTML form when muted, for a control that speaks the value itself', () => {
  const { container } = render(<QuantityText value={tag(2, unit('ft'))} mute />);
  const { form, spoken } = drawn(container);
  expect(form.innerHTML).toBe(present(tag(2, unit('ft'))).html);
  expect(spoken).toBeUndefined();
  expect(form.hasAttribute('aria-hidden')).toBe(false);
});

it('draws a unit alone as the unit part of a quantity, for one shown beside a field holding the number', () => {
  const { container } = render(<QuantityText unit="px" />);
  const part = container.querySelector('[data-part="unit"]');
  expect(part?.textContent).toBe('px');
  expect(container.textContent).toBe('px');
  expect(container.querySelector('data')).toBeNull();
});

it('draws a stacked fraction as its MathML form inside its <data value>, with the text form beside it for a copy', () => {
  const half = tag(1 / 2, fraction({ form: 'stacked' }));
  const { container } = render(<QuantityText value={half} />);
  const { form, spoken } = drawn(container);
  const data = form.querySelector('data')!;
  expect(data.getAttribute('value')).toBe('0.5');
  expect(data.querySelector('math mfrac')?.outerHTML).toBe('<mfrac><mn>1</mn><mn>2</mn></mfrac>');
  expect(data.querySelector('[data-part]')).toBeNull();
  expect(data.lastElementChild?.textContent).toBe('1/2');
  expect(form.getAttribute('aria-hidden')).toBe('true');
  expect(spoken).toBe('1 over 2');
});

it('keeps the HTML form for a fraction that is not stacked, and for a range of stacked ones', () => {
  expect(drawn(render(<QuantityText value={tag(1 / 2, fraction())} />).container).form.querySelector('math')).toBeNull();
  cleanup();
  const ends = [tag(1 / 4, fraction({ form: 'stacked' })), tag(1 / 2, fraction({ form: 'stacked' }))] as const;
  expect(drawn(render(<QuantityText range={ends} />).container).form.querySelector('math')).toBeNull();
});
