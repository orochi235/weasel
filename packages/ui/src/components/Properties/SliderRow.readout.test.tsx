import { render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SliderRow } from './PropertyPanel';

/**
 * A slider row's readout swaps between an editable input and a word when the row
 * goes auto. The label is a baseline-aligned flex line, so the two have to be
 * the same box or the swap moves the label's baseline — 3.5px, on every click
 * of the pin dot.
 *
 * jsdom resolves neither `var()` nor layout, so these assert the two proxies
 * that hold on this side of the boundary: that the swap goes through the same
 * wrapper element, and that both boxes take their height from the same token.
 * Only a browser can prove the pixels; the measurement is in the commit.
 */
describe('SliderRow auto readout', () => {
  // Comments stripped first: they talk about height, and a declaration regex cannot tell.
  const sheet = readFileSync(resolve(__dirname, 'Properties.module.css'), 'utf8').replace(
    /\/\*[\s\S]*?\*\//g,
    '',
  );
  const block = (name: string) => new RegExp(`\\.${name}\\s*\\{([^}]*)\\}`).exec(sheet)?.[1] ?? '';

  it('gives the text readout and the input the same height token', () => {
    // `[;{\s]` so `line-height` does not answer for `height`.
    const height = /[;{\s]height:\s*([^;]+);/;
    const text = height.exec(block('readoutText'))?.[1]?.trim();
    const input = height.exec(block('readoutInput'))?.[1]?.trim();
    expect(text).toBeDefined();
    expect(input).toBe(text);
  });

  it('wraps a text readout in the same group element the input uses', () => {
    const { container } = render(
      <SliderRow label="Width" value={20} min={0} max={100} readout="auto · 18" onChange={() => {}} />,
    );
    const group = container.querySelector('[class*="readoutGroup"]');
    expect(group?.textContent).toBe('auto · 18');
    expect(group?.firstElementChild?.className).toMatch(/readoutText/);
  });

  it('leaves the editable readout in place when the row is not auto', () => {
    const { container } = render(
      <SliderRow label="Width" value={20} min={0} max={100} onChange={() => {}} />,
    );
    const group = container.querySelector('[class*="readoutGroup"]');
    expect(group?.querySelector('input')).not.toBeNull();
  });

  it('passes a rendered readout through untouched, so a caller can style its own', () => {
    const { container } = render(
      <SliderRow
        label="Width"
        value={20}
        min={0}
        max={100}
        readout={<b data-testid="custom">mine</b>}
        onChange={() => {}}
      />,
    );
    const custom = container.querySelector('[data-testid="custom"]');
    expect(custom).not.toBeNull();
    expect(custom?.closest('[class*="readoutText"]')).toBeNull();
  });
});
