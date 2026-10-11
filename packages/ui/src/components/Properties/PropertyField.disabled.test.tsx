import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PropertyControl, PropertyField } from './PropertyField';

const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
];
const noop = (): void => {};

/** Disabled by the element's own `disabled`, or by `aria-disabled` where it is no form control. */
function expectDisabled(el: Element): void {
  expect(el.matches(':disabled') || el.getAttribute('aria-disabled') === 'true').toBe(true);
}

describe('PropertyControl disabled', () => {
  it('disables a checkbox, a switch, and a boolean toggle', () => {
    render(
      <>
        <PropertyControl kind="boolean" name="Box" value disabled onChange={noop} />
        <PropertyControl kind="boolean" control="switch" name="Switch" value disabled onChange={noop} />
        <PropertyControl kind="boolean" control="toggle" name="Toggle" value disabled onChange={noop} />
      </>,
    );
    expect(screen.getByRole('checkbox', { name: 'Box' })).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'Switch' })).toBeDisabled();
    expectDisabled(screen.getByRole('button', { name: 'Toggle' }));
  });

  it('disables a typed number and its steppers', () => {
    render(<PropertyControl kind="number" name="Radius" value={4} steppers disabled onChange={noop} />);
    expect(screen.getByRole('spinbutton', { name: 'Radius' })).toBeDisabled();
    for (const stepper of screen.getAllByRole('button', { hidden: true })) expect(stepper).toBeDisabled();
  });

  it('disables a slider track and its readout', () => {
    render(<PropertyControl kind="number" control="slider" name="Blur" value={4} disabled onChange={noop} />);
    expect(screen.getByRole('slider', { name: 'Blur' })).toBeDisabled();
    expect(screen.getByRole('spinbutton', { name: 'Blur' })).toBeDisabled();
  });

  it('disables a slider in a row of its own', () => {
    render(<PropertyField kind="number" control="slider" label="Blur" value={4} disabled onChange={noop} />);
    expect(screen.getByRole('slider', { name: 'Blur' })).toBeDisabled();
    expect(screen.getByRole('spinbutton', { name: 'Blur' })).toBeDisabled();
  });

  it('disables a text field and a textarea', () => {
    render(
      <>
        <PropertyControl kind="string" name="Title" value="x" disabled onChange={noop} />
        <PropertyControl kind="string" control="textarea" name="Notes" value="x" disabled onChange={noop} />
      </>,
    );
    expect(screen.getByRole('textbox', { name: 'Title' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Notes' })).toBeDisabled();
  });

  it('disables a select, a menu, every radio, and every segment', () => {
    render(
      <>
        <PropertyControl kind="enum" name="Select" value="a" options={OPTIONS} disabled onChange={noop} />
        <PropertyControl kind="enum" control="menu" name="Menu" value="a" options={OPTIONS} disabled onChange={noop} />
        <PropertyControl kind="enum" control="radio" name="Radio" value="a" options={OPTIONS} disabled onChange={noop} />
        <div data-testid="toggle">
          <PropertyControl kind="enum" control="toggle" name="Toggle" value="a" options={OPTIONS} disabled onChange={noop} />
        </div>
        <div data-testid="clearable">
          <PropertyControl kind="enum" control="toggle" name="Clearable" value="a" options={OPTIONS} disabled onChange={noop} onClear={noop} />
        </div>
      </>,
    );
    expect(screen.getByRole('button', { name: /Select/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Menu: Alpha' })).toBeDisabled();
    const radios = screen.getAllByRole('radio').filter((el) => el instanceof HTMLInputElement);
    expect(radios).toHaveLength(2);
    for (const radio of radios) expect(radio).toBeDisabled();
    for (const id of ['toggle', 'clearable']) {
      const segments = screen.getByTestId(id).querySelectorAll('button');
      expect(segments).toHaveLength(2);
      for (const segment of segments) expect(segment).toBeDisabled();
    }
  });

  it('disables a color swatch and its opacity track', () => {
    render(<PropertyControl kind="color" name="Tint" value="#ff0000" alpha disabled onChange={noop} />);
    expect(screen.getByLabelText('Tint')).toBeDisabled();
    expect(screen.getByRole('slider', { name: 'Tint opacity' })).toBeDisabled();
  });

  it('disables a paint swatch, and draws a disabled inline paint as its editor made inert', () => {
    render(
      <>
        <PropertyControl kind="paint" name="Fill" value={{ color: '#ff0000' }} disabled onChange={noop} />
        <PropertyControl kind="paint" control="inline" name="Stroke" value={{ color: '#00ff00' }} disabled onChange={noop} />
      </>,
    );
    expect(screen.getByRole('button', { name: 'Fill' })).toBeDisabled();
    const stroke = screen.getByRole('group', { name: 'Stroke' });
    expect(stroke).toHaveAttribute('aria-disabled', 'true');
    // A proxy: jsdom gives `inert` no consequence, so this reads the attribute. The browser test tabs past it.
    const bar = stroke.querySelector('[role="radiogroup"]')!;
    expect(bar.closest('[inert]')).not.toBeNull();
    expect(stroke).toContainElement(bar.closest<HTMLElement>('[inert]'));
  });

  it('disables the font pickers', () => {
    render(
      <>
        <PropertyControl kind="font-family" name="Family" value="Inter" disabled onChange={noop} />
        <PropertyControl kind="font-weight" name="Weight" value={400} disabled onChange={noop} />
      </>,
    );
    expect(screen.getByRole('button', { name: /Family/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Weight/ })).toBeDisabled();
  });

  it('leaves every control enabled without it', () => {
    render(
      <>
        <PropertyControl kind="boolean" name="Box" value onChange={noop} />
        <PropertyControl kind="number" name="Radius" value={4} onChange={noop} />
        <PropertyControl kind="enum" name="Select" value="a" options={OPTIONS} onChange={noop} />
      </>,
    );
    expect(screen.getByRole('checkbox', { name: 'Box' })).toBeEnabled();
    expect(screen.getByRole('spinbutton', { name: 'Radius' })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Select/ })).toBeEnabled();
  });
});
