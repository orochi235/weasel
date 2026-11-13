import { render } from '@testing-library/react';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readModuleCss } from '../../testing/readModuleCss';
import { PropertyField } from './PropertyField';

describe('number field unit', () => {
  it('renders a string unit after the field', () => {
    const { container } = render(
      <PropertyField kind="number" label="Width" value={20} unit="px" onChange={() => {}} />,
    );
    const input = container.querySelector('input[role="spinbutton"]');
    expect(input).not.toBeNull();
    // After the field, not before — the suffix reads as a trailing unit.
    const field = input?.closest('span > div');
    expect(field?.nextElementSibling?.textContent).toBe('px');
  });

  it('draws a string unit as QuantityText draws one, so it dims as a slider readout\'s unit does', () => {
    const { container } = render(
      <PropertyField kind="number" label="Width" value={20} unit="px" onChange={() => {}} />,
    );
    expect(container.querySelector('[data-part="unit"]')?.textContent).toBe('px');
  });

  it('renders a node unit as given', () => {
    const { container } = render(
      <PropertyField kind="number" label="Angle" value={90} unit={<sup>°</sup>} onChange={() => {}} />,
    );
    expect(container.querySelector('sup')?.textContent).toBe('°');
  });
});

describe('a unit whose glyph attaches', () => {
  const attached = (root: HTMLElement) => root.querySelector('[class*="unitAttached"]');

  it('is placed out of flow against the field, the field holding room for it', () => {
    const { container } = render(
      <PropertyField kind="number" label="Angle" value={90} unit="°" onChange={() => {}} />,
    );
    const glyph = attached(container);
    expect(glyph?.textContent).toBe('°');
    expect(glyph?.querySelector('[data-part="unit"]')?.hasAttribute('data-attach')).toBe(true);
    expect(glyph?.parentElement?.className).toMatch(/fieldUnitGroup/);
    expect(glyph?.parentElement?.className).toMatch(/unitHost/);
  });

  it('raises a percent sign, which sits on the baseline, and not a degree sign', () => {
    const { container } = render(
      <>
        <PropertyField kind="number" label="Opacity" value={50} unit="%" onChange={() => {}} />
        <PropertyField kind="number" label="Angle" value={90} unit="°" onChange={() => {}} />
      </>,
    );
    const units = [...container.querySelectorAll('[class*="unitAttached"] [data-part="unit"]')];
    expect(units.map((u) => [u.textContent, u.hasAttribute('data-raise')])).toEqual([['%', true], ['°', false]]);
  });

  it('is decided by the catalog, so a unit named by its alias attaches too', () => {
    const { container } = render(
      <PropertyField kind="number" label="Angle" value={90} unit="deg" onChange={() => {}} />,
    );
    expect(attached(container)?.textContent).toBe('°');
  });

  it('stays on the readout\'s line where an inline row hangs word units below it', () => {
    const { container } = render(
      <PropertyField kind="number" control="slider" layout="inline" label="Angle" value={45} min={0} max={90} unit="°" onChange={() => {}} />,
    );
    expect(container.querySelector('[class*="readoutAfter"]')).not.toBeNull();
    const glyph = attached(container);
    expect(glyph?.textContent).toBe('°');
    expect(glyph?.querySelector('[class*="readoutUnit"]')).toBeNull();
    expect(glyph?.parentElement?.className).toMatch(/unitHost/);
  });

  it('attaches in a read-only readout', () => {
    const { container } = render(
      <PropertyField kind="number" label="Angle" value={45} unit="%" readOnly onChange={() => {}} />,
    );
    const glyph = attached(container);
    expect(glyph?.textContent).toBe('%');
    expect(glyph?.parentElement?.className).toMatch(/unitHost/);
  });

  it('leaves a word unit in flow', () => {
    const { container } = render(
      <PropertyField kind="number" control="slider" layout="inline" label="Width" value={20} min={0} max={100} unit="px" onChange={() => {}} />,
    );
    expect(attached(container)).toBeNull();
    expect(container.querySelector('[class*="readoutUnit"]')?.textContent).toBe('px');
    expect(container.querySelector('[class*="unitHost"]')).toBeNull();
  });

  it('is positioned out of flow by the stylesheet, at the value\'s end', () => {
    const sheet = readModuleCss(resolve(process.cwd(), 'packages/ui/src/components/Properties/Properties.module.css'));
    expect(sheet).toMatch(/\.unitHost \{[^}]*position: relative;/);
    expect(sheet).toMatch(/\.unitAttached \{[^}]*position: absolute;[^}]*inset-inline-start: 100%;/);
    expect(sheet).toMatch(/\.fieldUnitGroup\.unitHost input \{[^}]*padding-inline-end:/);
  });
});

describe('number field spin buttons', () => {
  // Chrome reserves the spin-button gutter at the right edge whether or not it
  // paints the arrows, which is what pushed a right-aligned value clear of its
  // own border and left a gap a unit looked like it should fill. jsdom computes
  // no appearance and renders no pseudo-element, so there is nothing here to
  // assert against — the stylesheet is the only place the removal is visible.
  const sheet = readModuleCss(
    resolve(process.cwd(), 'packages/ui/src/components/Properties/Properties.module.css'),
  );

  it('drops the native steppers on a number input handed to a row', () => {
    const row = String.raw`\.row > input\[type='number'\]`;
    expect(sheet).toMatch(new RegExp(String.raw`${row}::-webkit-inner-spin-button[^}]*-webkit-appearance: none;`));
    expect(sheet).toMatch(new RegExp(String.raw`${row}:not\(\.readoutInput\)[^}]*appearance: textfield;`));
  });
});
