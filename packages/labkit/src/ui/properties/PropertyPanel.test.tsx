import { fireEvent, render, screen } from '@testing-library/react';
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
    expect(container.querySelector('.lk-property-panel__title')).toBeNull();
  });

  it('renders children directly (no implicit grid)', () => {
    const { container } = render(
      <PropertyPanel>
        <span>raw child</span>
      </PropertyPanel>,
    );
    expect(container.querySelector('.lk-property-list')).toBeNull();
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
    expect(container.querySelector('.lk-property-list')).not.toBeNull();
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
    expect(container.querySelector('.lk-property-row--color')).not.toBeNull();
  });
});

describe('SliderRow', () => {
  it('emits numeric value on change', () => {
    const onChange = vi.fn();
    render(<SliderRow label="Op" value={10} min={0} max={100} onChange={onChange} />);
    fireEvent.change(screen.getByRole('slider'), { target: { value: '42' } });
    expect(onChange).toHaveBeenCalledWith(42);
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
    expect(screen.getByText('0.50')).toBeInTheDocument();
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
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'b' } });
    expect(onChange).toHaveBeenCalledWith('b');
  });
});

describe('ToggleRow', () => {
  it('marks the active option aria-checked and emits on click', () => {
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
    expect(left).toHaveAttribute('aria-checked', 'true');
    expect(right).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(right);
    expect(onChange).toHaveBeenCalledWith('right');
  });
});
