import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  CheckboxRow,
  ColorRow,
  NumberRow,
  PropertyList,
  PropertyPanel,
  PropertyRow,
  SelectRow,
  SliderRow,
  TextRow,
  ToggleRow,
} from './PropertyPanel';
import s from './Properties.module.css';

describe('PropertyPanel', () => {
  it('renders title and children', () => {
    render(
      <PropertyPanel title="Shape">
        <PropertyRow label="A">
          <input type="text" defaultValue="x" />
        </PropertyRow>
      </PropertyPanel>,
    );
    expect(screen.getByRole('heading', { name: 'Shape' })).toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('omits the heading when no title is given', () => {
    const { container } = render(
      <PropertyPanel>
        <PropertyRow label="A">
          <input type="text" defaultValue="x" />
        </PropertyRow>
      </PropertyPanel>,
    );
    expect(container.querySelector(`.${s.panelTitle}`)).toBeNull();
  });

  it('renders children directly (no implicit grid)', () => {
    const { container } = render(
      <PropertyPanel>
        <span>raw child</span>
      </PropertyPanel>,
    );
    expect(container.querySelector(`.${s.list}`)).toBeNull();
    expect(screen.getByText('raw child')).toBeInTheDocument();
  });
});

describe('PropertyList', () => {
  it('renders a grid container', () => {
    const { container } = render(
      <PropertyList>
        <PropertyRow label="A">
          <input type="text" defaultValue="x" />
        </PropertyRow>
      </PropertyList>,
    );
    expect(container.querySelector(`.${s.list}`)).not.toBeNull();
  });
});

describe('PropertyRow', () => {
  it('renders label and optional readout', () => {
    render(
      <PropertyRow label="Opacity" readout="0.65">
        <input type="range" defaultValue={50} />
      </PropertyRow>,
    );
    expect(screen.getByText('Opacity')).toBeInTheDocument();
    expect(screen.getByText('0.65')).toBeInTheDocument();
  });

  it('applies variant class', () => {
    const { container } = render(
      <PropertyRow label="L" variant="color">
        <input type="color" defaultValue="#fff" />
      </PropertyRow>,
    );
    expect(container.querySelector(`.${s.rowColor}`)).not.toBeNull();
  });

  it('renders a help affordance for a non-empty description', () => {
    render(
      <PropertyRow label="Opacity" description="How see-through the shape is.">
        <input type="text" defaultValue="x" />
      </PropertyRow>,
    );
    expect(screen.getByRole('button', { name: 'About Opacity' })).toBeInTheDocument();
  });

  it('renders no help affordance for an empty or absent description', () => {
    const { container, rerender } = render(
      <PropertyRow label="Opacity" description="">
        <input type="text" defaultValue="x" />
      </PropertyRow>,
    );
    expect(container.querySelector(`.${s.help}`)).toBeNull();
    rerender(
      <PropertyRow label="Opacity">
        <input type="text" defaultValue="x" />
      </PropertyRow>,
    );
    expect(container.querySelector(`.${s.help}`)).toBeNull();
  });

  it('shows the description in a tooltip on keyboard focus', () => {
    render(
      <PropertyRow label="Opacity" description="How see-through the shape is.">
        <input type="text" defaultValue="x" />
      </PropertyRow>,
    );
    const help = screen.getByRole('button', { name: 'About Opacity' });
    expect(screen.queryByRole('tooltip')).toBeNull();
    // RAC only opens a tooltip under keyboard modality.
    fireEvent.keyDown(document.body, { key: 'Tab' });
    act(() => help.focus());
    expect(screen.getByRole('tooltip')).toHaveTextContent('How see-through the shape is.');
  });

  it('does not actuate the row control when the help affordance is clicked', () => {
    const onChange = vi.fn();
    render(
      <CheckboxRow label="Visible" value={false} onChange={onChange} description="Show it." />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'About Visible' }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('spans the grid when span is set', () => {
    const { container, rerender } = render(
      <PropertyRow label="L" span>
        <input type="text" defaultValue="x" />
      </PropertyRow>,
    );
    expect(container.querySelector(`.${s.row}`)).toHaveClass(s.span);
    rerender(
      <PropertyRow label="L">
        <input type="text" defaultValue="x" />
      </PropertyRow>,
    );
    expect(container.querySelector(`.${s.row}`)).not.toHaveClass(s.span);
  });
});

describe('SliderRow', () => {
  it('emits numeric value on change', () => {
    const onChange = vi.fn();
    render(<SliderRow label="Op" value={10} min={0} max={100} onChange={onChange} />);
    fireEvent.change(screen.getByRole('slider'), { target: { value: '42' } });
    expect(onChange).toHaveBeenCalledWith(42);
  });

  // A slider is controlled, so a test that drops the live value gets the DOM
  // value snapped back and cannot see what the release reports.
  function LiveSlider({
    onInput,
    onChange,
  }: {
    onInput?: (n: number) => void;
    onChange: (n: number) => void;
  }) {
    const [v, setV] = useState(10);
    const live = (n: number) => {
      setV(n);
      onInput?.(n);
    };
    return (
      <SliderRow
        label="Op"
        value={v}
        min={0}
        max={100}
        onInput={onInput ? live : undefined}
        onChange={
          onInput
            ? onChange
            : (n) => {
                setV(n);
                onChange(n);
              }
        }
      />
    );
  }

  it('reports moves to onInput and the release to onChange', () => {
    const onInput = vi.fn();
    const onChange = vi.fn();
    render(<LiveSlider onInput={onInput} onChange={onChange} />);
    const slider = screen.getByRole('slider');
    fireEvent.input(slider, { target: { value: '42' } });
    expect(onInput).toHaveBeenCalledWith(42);
    expect(onChange).not.toHaveBeenCalled();
    // A drag ends with a bare `change` — the value it carries is the one the
    // last `input` already reported, which is why this one sets none.
    fireEvent.change(slider);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(42);
    expect(onInput).toHaveBeenCalledTimes(1);
  });

  it('keeps a lone onChange live, with no second call on release', () => {
    const onChange = vi.fn();
    render(<LiveSlider onChange={onChange} />);
    const slider = screen.getByRole('slider');
    fireEvent.input(slider, { target: { value: '42' } });
    fireEvent.change(slider);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(42);
  });

  it('sends a typed readout through both halves of the pair', () => {
    const onInput = vi.fn();
    const onChange = vi.fn();
    render(<LiveSlider onInput={onInput} onChange={onChange} />);
    const readout = screen.getByRole('textbox');
    fireEvent.focus(readout);
    fireEvent.change(readout, { target: { value: '55' } });
    fireEvent.blur(readout);
    expect(onInput).toHaveBeenCalledWith(55);
    expect(onChange).toHaveBeenCalledWith(55);
  });

  it('shows a compact notation and reads a typed suffix back', () => {
    const onChange = vi.fn();
    render(
      <SliderRow
        label="Glyphs"
        value={2_000_000}
        min={0}
        max={2_000_000}
        step={1000}
        notation="compact"
        onChange={onChange}
      />,
    );
    const readout = screen.getByRole('textbox');
    expect(readout).toHaveValue('2.0M');
    fireEvent.focus(readout);
    fireEvent.change(readout, { target: { value: '2.5k' } });
    fireEvent.blur(readout);
    expect(onChange).toHaveBeenCalledWith(2500);
  });

  it('reverts an empty readout instead of committing zero', () => {
    const onChange = vi.fn();
    render(<SliderRow label="Op" value={10} min={0} max={100} onChange={onChange} />);
    const readout = screen.getByRole('textbox');
    fireEvent.focus(readout);
    fireEvent.change(readout, { target: { value: '' } });
    fireEvent.blur(readout);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('publishes the widest value its range can show', () => {
    render(<SliderRow label="Op" value={5} min={0} max={200_000} onChange={() => {}} />);
    // jsdom does no layout, so this reads the custom property the width is taken from.
    expect(screen.getByRole('textbox').style.getPropertyValue('--wzl-property-readout-fit')).toBe(
      '6ch',
    );
  });

  it('formats the readout when format is supplied', () => {
    render(
      <SliderRow
        label="Op"
        value={0.5}
        min={0}
        max={1}
        step={0.01}
        onChange={() => {}}
        format={(v) => v.toFixed(2)}
      />,
    );
    expect(screen.getByDisplayValue('0.50')).toBeInTheDocument();
  });
});

describe('ColorRow', () => {
  it('emits the new hex on change', () => {
    const onChange = vi.fn();
    const { container } = render(<ColorRow label="Fill" value="#ffffff" onChange={onChange} />);
    const input = container.querySelector('input[type="color"]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '#aa3300' } });
    expect(onChange).toHaveBeenCalledWith('#aa3300');
  });
});

describe('CheckboxRow', () => {
  it('toggles the boolean', () => {
    const onChange = vi.fn();
    render(<CheckboxRow label="Visible" value={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe('TextRow', () => {
  it('emits the new text on change', () => {
    const onChange = vi.fn();
    render(<TextRow label="Name" value="foo" onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('foo'), { target: { value: 'bar' } });
    expect(onChange).toHaveBeenCalledWith('bar');
  });
});

describe('NumberRow', () => {
  it('emits a number on change', () => {
    const onChange = vi.fn();
    render(<NumberRow label="N" value={1} onChange={onChange} />);
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '42' } });
    expect(onChange).toHaveBeenCalledWith(42);
  });

  it('ignores non-finite values', () => {
    const onChange = vi.fn();
    render(<NumberRow label="N" value={1} onChange={onChange} />);
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: 'abc' } });
    expect(onChange).not.toHaveBeenCalled();
  });
});

/** A select row's trigger, which opens its listbox. Its accessible name is the
 *  value then the label ("A Mode"), and a described row's ⓘ is "About <label>",
 *  so the label alone matches both. */
const trigger = (label: string) =>
  screen.getByRole('button', { name: new RegExp(`(?<!About )${label}`) });

/** Opens a select row and chooses an option, the way a person does. */
function pick(label: string, option: string) {
  act(() => {
    fireEvent.click(trigger(label));
  });
  fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: option }));
}

describe('SelectRow', () => {
  it('emits the selected option', () => {
    const onChange = vi.fn();
    render(
      <SelectRow
        label="Mode"
        value="a"
        options={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ]}
        onChange={onChange}
      />,
    );
    expect(screen.queryByRole('combobox')).toBeNull();
    pick('Mode', 'B');
    expect(onChange).toHaveBeenCalledWith('b');
  });
});

describe('ToggleRow', () => {
  it('marks the active option aria-pressed and emits on click', () => {
    const onChange = vi.fn();
    render(
      <ToggleRow
        label="Align"
        value="left"
        options={[
          { value: 'left', label: 'L' },
          { value: 'right', label: 'R' },
        ]}
        onChange={onChange}
      />,
    );
    const left = screen.getByText('L');
    const right = screen.getByText('R');
    expect(left).toHaveAttribute('aria-pressed', 'true');
    expect(right).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(right);
    expect(onChange).toHaveBeenCalledWith('right');
  });

  // A <label> forwards a click on its text to its first control, which here is
  // the first option — so a near-miss on the pin dot selected an option.
  it('selects nothing when its label text is clicked', () => {
    const onChange = vi.fn();
    render(
      <ToggleRow
        label="Align"
        value="right"
        options={[
          { value: 'left', label: 'L' },
          { value: 'right', label: 'R' },
        ]}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByText('Align'));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('row names', () => {
  const options = [
    { value: 'a', label: 'A' },
    { value: 'b', label: 'B' },
  ];

  it("names SliderRow's slider after its label", () => {
    render(<SliderRow label="Opacity" value={10} min={0} max={100} onChange={() => {}} />);
    expect(screen.getByRole('slider', { name: 'Opacity' })).toBeInTheDocument();
  });

  it("names NumberRow's field after its label", () => {
    render(<NumberRow label="N" value={1} onChange={() => {}} />);
    expect(screen.getByRole('spinbutton', { name: 'N' })).toBeInTheDocument();
  });

  it("names TextRow's field after its label", () => {
    render(<TextRow label="Name" value="foo" onChange={() => {}} />);
    expect(screen.getByRole('textbox', { name: 'Name' })).toBeInTheDocument();
  });

  it("names SelectRow's trigger after its label", () => {
    render(<SelectRow label="Mode" value="a" options={options} onChange={() => {}} />);
    expect(trigger('Mode')).toBeInTheDocument();
  });

  it("names ColorRow's swatch after its label", () => {
    const { container } = render(<ColorRow label="Fill" value="#ffffff" onChange={() => {}} />);
    expect(container.querySelector('input[type="color"]')).toHaveAccessibleName('Fill');
  });

  it("names CheckboxRow's box after its label", () => {
    render(<CheckboxRow label="Visible" value={false} onChange={() => {}} />);
    expect(screen.getByRole('checkbox', { name: 'Visible' })).toBeInTheDocument();
  });

  it("names ToggleRow's segments after their options", () => {
    render(<ToggleRow label="Align" value="a" options={options} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'A' })).toBeInTheDocument();
  });

  it("names ToggleRow's group after its label", () => {
    render(<ToggleRow label="Align" value="a" options={options} onChange={() => {}} />);
    expect(screen.getByRole('group', { name: 'Align' })).toBeInTheDocument();
  });

  // The help button is labelable and comes first, so the row's <label> labels it instead.
  describe('with a description', () => {
    it('SliderRow', () => {
      render(<SliderRow label="Opacity" description="d" value={10} min={0} max={100} onChange={() => {}} />);
      expect(screen.getByRole('slider', { name: 'Opacity' })).toBeInTheDocument();
    });
    it('SliderRow readout', () => {
      render(<SliderRow label="Opacity" description="d" value={10} min={0} max={100} onChange={() => {}} />);
      expect(screen.getByRole('textbox', { name: 'Opacity' })).toBeInTheDocument();
    });
    it('NumberRow', () => {
      render(<NumberRow label="N" description="d" value={1} onChange={() => {}} />);
      expect(screen.getByRole('spinbutton', { name: 'N' })).toBeInTheDocument();
    });
    it('TextRow', () => {
      render(<TextRow label="Name" description="d" value="foo" onChange={() => {}} />);
      expect(screen.getByRole('textbox', { name: 'Name' })).toBeInTheDocument();
    });
    it('SelectRow', () => {
      render(<SelectRow label="Mode" description="d" value="a" options={options} onChange={() => {}} />);
      expect(trigger('Mode')).toBeInTheDocument();
    });
    it('ColorRow', () => {
      const { container } = render(<ColorRow label="Fill" description="d" value="#ffffff" onChange={() => {}} />);
      expect(container.querySelector('input[type="color"]')).toHaveAccessibleName('Fill');
    });
    it('CheckboxRow', () => {
      render(<CheckboxRow label="Visible" description="d" value={false} onChange={() => {}} />);
      expect(screen.getByRole('checkbox', { name: 'Visible' })).toBeInTheDocument();
    });
  });
});

// The help button is the first labelable element in a described row, so a <label> without `for`
// belongs to it rather than to the control.
describe('described rows', () => {
  const options = [
    { value: 'a', label: 'A' },
    { value: 'b', label: 'B' },
  ];

  it("CheckboxRow toggles when its label's text is clicked", () => {
    const onChange = vi.fn();
    render(<CheckboxRow label="Visible" description="d" value={false} onChange={onChange} />);
    fireEvent.click(screen.getByText('Visible'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  // `label.control` is the element a click on the label activates. getByLabelText cannot stand in:
  // it takes a label's first form control inside it and ignores `for`, so it always finds the ⓘ.
  const controlOf = (container: HTMLElement) => container.querySelector('label')?.control;

  it("TextRow's label is its field's", () => {
    const { container } = render(<TextRow label="Name" description="d" value="foo" onChange={() => {}} />);
    expect(controlOf(container)).toBe(screen.getByRole('textbox', { name: 'Name' }));
  });

  it("NumberRow's label is its field's", () => {
    const { container } = render(<NumberRow label="N" description="d" value={1} onChange={() => {}} />);
    expect(controlOf(container)).toBe(screen.getByRole('spinbutton', { name: 'N' }));
  });

  it("SelectRow's label is its trigger's", () => {
    const { container } = render(
      <SelectRow label="Mode" description="d" value="a" options={options} onChange={() => {}} />,
    );
    expect(controlOf(container)).toBe(trigger('Mode'));
  });

  it("ColorRow's label is its swatch's", () => {
    const { container } = render(
      <ColorRow label="Fill" description="d" value="#ffffff" onChange={() => {}} />,
    );
    expect(controlOf(container)).toBe(container.querySelector('input[type="color"]'));
  });

  it("names ColorRow's alpha slider after its label", () => {
    render(<ColorRow label="Fill" description="d" value="#ffffff" alpha={0.5} onChange={() => {}} />);
    expect(screen.getByRole('slider', { name: 'Fill opacity' })).toBeInTheDocument();
  });
});

describe('rows with no value', () => {
  const options = [
    { value: 'a', label: 'A' },
    { value: 'b', label: 'B' },
  ];

  it('SelectRow shows a placeholder, not the first option, and choosing the first option fires', () => {
    const onChange = vi.fn();
    render(<SelectRow label="Mode" value={undefined} options={options} onChange={onChange} />);
    expect(trigger('Mode')).toHaveTextContent('Choose option…');
    pick('Mode', options[0]!.label as string);
    expect(onChange).toHaveBeenCalledWith('a');
  });

  it('SelectRow shows the placeholder for a value that is not an option', () => {
    render(<SelectRow label="Mode" value="z" options={options} onChange={() => {}} />);
    expect(trigger('Mode')).toHaveTextContent('Choose option…');
  });

  it('SelectRow renders a present value with no placeholder', () => {
    render(<SelectRow label="Mode" value="b" options={options} onChange={() => {}} />);
    expect(trigger('Mode')).toHaveTextContent(options[1]!.label as string);
    expect(trigger('Mode')).not.toHaveTextContent('Choose option…');
  });

  it('SelectRow names its placeholder', () => {
    render(<SelectRow label="Mode" value={undefined} options={options} placeholder="Pick one" onChange={() => {}} />);
    expect(trigger('Mode')).toHaveTextContent('Pick one');
  });

  // React warns about a controlled/uncontrolled switch once per module, so these assert the DOM instead.
  it('CheckboxRow clears when its value goes away, and checks when one arrives', () => {
    const { rerender } = render(<CheckboxRow label="On" value onChange={() => {}} />);
    const box = () => screen.getByRole<HTMLInputElement>('checkbox');
    expect(box().checked).toBe(true);
    rerender(<CheckboxRow label="On" value={undefined} onChange={() => {}} />);
    expect(box().checked).toBe(false);
    rerender(<CheckboxRow label="On" value onChange={() => {}} />);
    expect(box().checked).toBe(true);
  });

  it('TextRow clears when its value goes away, and shows one that arrives', () => {
    const { rerender } = render(<TextRow label="Name" value="foo" onChange={() => {}} />);
    const field = () => screen.getByRole<HTMLInputElement>('textbox');
    rerender(<TextRow label="Name" value={undefined} onChange={() => {}} />);
    expect(field().value).toBe('');
    rerender(<TextRow label="Name" value="bar" onChange={() => {}} />);
    rerender(<TextRow label="Name" value={null} onChange={() => {}} />);
    expect(field().value).toBe('');
    rerender(<TextRow label="Name" value="baz" onChange={() => {}} />);
    expect(field().value).toBe('baz');
  });

  it('NumberRow clears when its value goes away, and shows one that arrives', () => {
    const { rerender } = render(<NumberRow label="N" value={5} onChange={() => {}} />);
    const field = () => screen.getByRole<HTMLInputElement>('spinbutton');
    rerender(<NumberRow label="N" value={undefined} onChange={() => {}} />);
    expect(field().value).toBe('');
    rerender(<NumberRow label="N" value={6} onChange={() => {}} />);
    rerender(<NumberRow label="N" value={null} onChange={() => {}} />);
    expect(field().value).toBe('');
    rerender(<NumberRow label="N" value={0} onChange={() => {}} />);
    expect(field().value).toBe('0');
  });
});

describe('auto rows', () => {
  it('marks an auto row and renders its dot only when it can be toggled', () => {
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

  it('puts the dot before the readout, so live text stays last in the row', () => {
    const { container } = render(
      <PropertyRow label="Gap" auto readout="auto · 18 px" onAutoChange={() => {}}>
        <input />
      </PropertyRow>,
    );
    const kids = [...(container.querySelector('label > span')?.children ?? [])];
    const dot = kids.findIndex((el) => el.getAttribute('aria-label') === 'Pin Gap');
    const readout = kids.findIndex((el) => el.tagName === 'EM');
    expect(dot).toBeGreaterThanOrEqual(0);
    expect(dot).toBeLessThan(readout);
  });

  it('puts data-auto-path on the row element for a panel-level gesture handler', () => {
    const { container } = render(
      <PropertyRow label="Gap" data-auto-path="grid.gap" onAutoChange={() => {}}>
        <input />
      </PropertyRow>,
    );
    expect(container.querySelector('label')?.getAttribute('data-auto-path')).toBe('grid.gap');
  });

  it('leaves a row label naming its control, not the pin dot beside it', () => {
    const { container } = render(
      <SliderRow
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

  it('SliderRow forwards auto and onAutoChange', () => {
    const { container } = render(
      <SliderRow
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

  it('NumberRow forwards auto and onAutoChange', () => {
    const { container } = render(
      <NumberRow label="Count" value={3} onChange={() => {}} auto onAutoChange={() => {}} />,
    );
    expect(container.querySelector('label')?.className).toMatch(/rowAuto/);
    expect(screen.getByRole('button', { name: 'Pin Count' })).toBeInTheDocument();
  });

  it('SelectRow forwards auto and onAutoChange', () => {
    const { container } = render(
      <SelectRow
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

  it('ToggleRow forwards auto and onAutoChange', () => {
    const { container } = render(
      <ToggleRow
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

  it('CheckboxRow forwards auto and onAutoChange', () => {
    const { container } = render(
      <CheckboxRow label="Snap" value={true} onChange={() => {}} auto onAutoChange={() => {}} />,
    );
    expect(container.querySelector('label')?.className).toMatch(/rowAuto/);
    expect(screen.getByRole('button', { name: 'Pin Snap' })).toBeInTheDocument();
  });

  it('ColorRow forwards auto and onAutoChange', () => {
    const { container } = render(
      <ColorRow label="Fill" value="#ff0000" onChange={() => {}} auto onAutoChange={() => {}} />,
    );
    expect(container.querySelector('label')?.className).toMatch(/rowAuto/);
    expect(screen.getByRole('button', { name: 'Pin Fill' })).toBeInTheDocument();
  });

  it('TextRow forwards auto and onAutoChange', () => {
    const { container } = render(
      <TextRow label="Name" value="foo" onChange={() => {}} auto onAutoChange={() => {}} />,
    );
    expect(container.querySelector('label')?.className).toMatch(/rowAuto/);
    expect(screen.getByRole('button', { name: 'Pin Name' })).toBeInTheDocument();
  });
});

describe('auto readouts', () => {
  const READOUT = 'auto · 18 px';

  it('SliderRow shows a static readout, not an editable field, when given one', () => {
    render(
      <SliderRow
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
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('NumberRow shows its auto readout', () => {
    render(<NumberRow label="Count" value={3} onChange={() => {}} readout={READOUT} auto />);
    expect(screen.getByText(READOUT)).toBeInTheDocument();
  });

  it('SelectRow shows its auto readout', () => {
    render(
      <SelectRow
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

  it('ToggleRow shows its auto readout', () => {
    render(
      <ToggleRow
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

  it('CheckboxRow shows its auto readout', () => {
    render(<CheckboxRow label="Snap" value onChange={() => {}} readout={READOUT} auto />);
    expect(screen.getByText(READOUT)).toBeInTheDocument();
  });

  it('ColorRow shows its auto readout', () => {
    render(<ColorRow label="Fill" value="#ff0000" onChange={() => {}} readout={READOUT} auto />);
    expect(screen.getByText(READOUT)).toBeInTheDocument();
  });

  it('TextRow shows its auto readout', () => {
    render(<TextRow label="Name" value="foo" onChange={() => {}} readout={READOUT} auto />);
    expect(screen.getByText(READOUT)).toBeInTheDocument();
  });
});
