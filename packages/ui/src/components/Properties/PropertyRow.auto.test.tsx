import { createEvent, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PropertyField } from './PropertyField';
import { PropertyRow } from './PropertyRow';

describe('auto rows', () => {
  it('marks an auto row and makes its label the toggle only when it can be toggled', () => {
    const { rerender, container } = render(
      <PropertyRow label="Gap" auto onAutoChange={() => {}}>
        <input />
      </PropertyRow>,
    );
    expect(container.querySelector('label')?.className).toMatch(/rowAuto/);
    expect(screen.getByRole('button', { name: 'Pin Gap' })).toBeInTheDocument();

    rerender(
      <PropertyRow label="Gap" auto>
        <input />
      </PropertyRow>,
    );
    expect(screen.queryByRole('button', { name: 'Pin Gap' })).toBeNull();
  });

  it('shows the readout a caller gives an auto row', () => {
    render(
      <PropertyRow label="Gap" auto readout="auto · 18 px" onAutoChange={() => {}}>
        <input />
      </PropertyRow>,
    );
    expect(screen.getByText('auto · 18 px')).toBeInTheDocument();
  });

  it('puts the label before the readout, so live text stays last in the row', () => {
    const { container } = render(
      <PropertyRow label="Gap" auto readout="auto · 18 px" onAutoChange={() => {}}>
        <input />
      </PropertyRow>,
    );
    const kids = [...(container.querySelector('label > span')?.children ?? [])];
    const toggle = kids.findIndex((el) => el.getAttribute('aria-label') === 'Pin Gap');
    const readout = kids.findIndex((el) => el.tagName === 'EM');
    expect(toggle).toBeGreaterThanOrEqual(0);
    expect(toggle).toBeLessThan(readout);
  });

  it('toggles auto when the label is clicked', () => {
    const onAutoChange = vi.fn();
    render(
      <PropertyRow label="Gap" htmlFor="gap" onAutoChange={onAutoChange}>
        <input id="gap" />
      </PropertyRow>,
    );
    const click = createEvent.click(screen.getByRole('button', { name: 'Pin Gap' }));
    fireEvent(screen.getByRole('button', { name: 'Pin Gap' }), click);
    expect(onAutoChange).toHaveBeenCalledWith(true);
    // The row is a <label>, so the click would otherwise land on the control
    // as well. jsdom runs no label activation of its own, which makes the
    // obvious assertion — that the input stayed unfocused — pass either way;
    // what the browser reads is the prevented default.
    expect(click.defaultPrevented).toBe(true);
  });

  it('gives the label back when the row cannot go auto', () => {
    render(
      <PropertyRow label="Gap">
        <input />
      </PropertyRow>,
    );
    expect(screen.queryByRole('button', { name: 'Pin Gap' })).toBeNull();
    expect(screen.getByText('Gap')).toBeInTheDocument();
  });

  it('leaves a row label naming its control, not the toggle it doubles as', () => {
    const { container } = render(
      <PropertyField
        kind="number"
        control="slider"
        label="Gap"
        value={12}
        min={0}
        max={48}
        onChange={() => {}}
        auto
        onAutoChange={() => {}}
      />,
    );
    const label = container.querySelector('label') as HTMLLabelElement;
    expect(label.control).not.toBe(screen.getByRole('button', { name: 'Pin Gap' }));
    expect(label.control).toHaveAttribute('aria-label', 'Gap');
  });

  it('slider field forwards auto and onAutoChange', () => {
    const { container } = render(
      <PropertyField
        kind="number"
        control="slider"
        label="Gap"
        value={12}
        min={0}
        max={48}
        onChange={() => {}}
        auto
        onAutoChange={() => {}}
      />,
    );
    expect(container.querySelector('label')?.className).toMatch(/rowAuto/);
    expect(screen.getByRole('button', { name: 'Pin Gap' })).toBeInTheDocument();
  });

  it('number field forwards auto and onAutoChange', () => {
    const { container } = render(
      <PropertyField kind="number" label="Count" value={3} onChange={() => {}} auto onAutoChange={() => {}} />,
    );
    expect(container.querySelector('label')?.className).toMatch(/rowAuto/);
    expect(screen.getByRole('button', { name: 'Pin Count' })).toBeInTheDocument();
  });

  it('select field forwards auto and onAutoChange', () => {
    const { container } = render(
      <PropertyField
        kind="enum"
        label="Mode"
        value="a"
        options={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ]}
        onChange={() => {}}
        auto
        onAutoChange={() => {}}
      />,
    );
    expect(container.querySelector('label')?.className).toMatch(/rowAuto/);
    // The Select's own trigger is a button named "Mode" too, so the dot is
    // matched by its full name rather than by the label alone.
    expect(screen.getByRole('button', { name: 'Pin Mode' })).toBeInTheDocument();
  });

  it('toggle field forwards auto and onAutoChange', () => {
    const { container } = render(
      <PropertyField
        kind="enum"
        control="toggle"
        label="Fit"
        value="a"
        options={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ]}
        onChange={() => {}}
        auto
        onAutoChange={() => {}}
      />,
    );
    expect((container.firstElementChild as HTMLElement | null)?.className).toMatch(/rowAuto/);
    expect(screen.getByRole('button', { name: 'Pin Fit' })).toBeInTheDocument();
  });

  it('checkbox field forwards auto and onAutoChange', () => {
    const { container } = render(
      <PropertyField kind="boolean" label="Snap" value={true} onChange={() => {}} auto onAutoChange={() => {}} />,
    );
    expect(container.querySelector('label')?.className).toMatch(/rowAuto/);
    expect(screen.getByRole('button', { name: 'Pin Snap' })).toBeInTheDocument();
  });

  it('color field forwards auto and onAutoChange', () => {
    const { container } = render(
      <PropertyField kind="color" label="Fill" value="#ff0000" onChange={() => {}} auto onAutoChange={() => {}} />,
    );
    expect(container.querySelector('label')?.className).toMatch(/rowAuto/);
    expect(screen.getByRole('button', { name: 'Pin Fill' })).toBeInTheDocument();
  });

  it('text field forwards auto and onAutoChange', () => {
    const { container } = render(
      <PropertyField kind="string" label="Name" value="foo" onChange={() => {}} auto onAutoChange={() => {}} />,
    );
    expect(container.querySelector('label')?.className).toMatch(/rowAuto/);
    expect(screen.getByRole('button', { name: 'Pin Name' })).toBeInTheDocument();
  });
});

describe('auto readouts', () => {
  const READOUT = 'auto · 18 px';

  it('slider field shows a static readout, not an editable field, when given one', () => {
    render(
      <PropertyField
        kind="number"
        control="slider"
        label="Gap"
        value={12}
        min={0}
        max={48}
        onChange={() => {}}
        readout={READOUT}
        auto
        onAutoChange={() => {}}
      />,
    );
    expect(screen.getByText(READOUT)).toBeInTheDocument();
    expect(screen.queryByDisplayValue(READOUT)).toBeNull();
    expect(screen.queryByRole('spinbutton')).toBeNull();
  });

  it('number field shows its auto readout', () => {
    render(<PropertyField kind="number" label="Count" value={3} onChange={() => {}} readout={READOUT} auto />);
    expect(screen.getByText(READOUT)).toBeInTheDocument();
  });

  it('select field shows its auto readout', () => {
    render(
      <PropertyField
        kind="enum"
        label="Mode"
        value="a"
        options={[{ value: 'a', label: 'A' }]}
        onChange={() => {}}
        readout={READOUT}
        auto
      />,
    );
    expect(screen.getByText(READOUT)).toBeInTheDocument();
  });

  it('toggle field shows its auto readout', () => {
    render(
      <PropertyField
        kind="enum"
        control="toggle"
        label="Fit"
        value="a"
        options={[{ value: 'a', label: 'A' }]}
        onChange={() => {}}
        readout={READOUT}
        auto
      />,
    );
    expect(screen.getByText(READOUT)).toBeInTheDocument();
  });

  it('checkbox field shows its auto readout', () => {
    render(<PropertyField kind="boolean" label="Snap" value onChange={() => {}} readout={READOUT} auto />);
    expect(screen.getByText(READOUT)).toBeInTheDocument();
  });

  it('color field shows its auto readout', () => {
    render(<PropertyField kind="color" label="Fill" value="#ff0000" onChange={() => {}} readout={READOUT} auto />);
    expect(screen.getByText(READOUT)).toBeInTheDocument();
  });

  it('text field shows its auto readout', () => {
    render(<PropertyField kind="string" label="Name" value="foo" onChange={() => {}} readout={READOUT} auto />);
    expect(screen.getByText(READOUT)).toBeInTheDocument();
  });
});
