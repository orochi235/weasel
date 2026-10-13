import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PropertyField } from './PropertyField';
import { trigger } from './testing/selectRow';

describe('row names', () => {
  const options = [
    { value: 'a', label: 'A' },
    { value: 'b', label: 'B' },
  ];

  it("names slider field's slider after its label", () => {
    render(<PropertyField kind="number" control="slider" label="Opacity" value={10} min={0} max={100} onChange={() => {}} />);
    expect(screen.getByRole('slider', { name: 'Opacity' })).toBeInTheDocument();
  });

  it("names number field's field after its label", () => {
    render(<PropertyField kind="number" label="N" value={1} onChange={() => {}} />);
    expect(screen.getByRole('spinbutton', { name: 'N' })).toBeInTheDocument();
  });

  it("names text field's field after its label", () => {
    render(<PropertyField kind="string" label="Name" value="foo" onChange={() => {}} />);
    expect(screen.getByRole('textbox', { name: 'Name' })).toBeInTheDocument();
  });

  it("names select field's trigger after its label", () => {
    render(<PropertyField kind="enum" label="Mode" value="a" options={options} onChange={() => {}} />);
    expect(trigger('Mode')).toBeInTheDocument();
  });

  it("names color field's swatch after its label", () => {
    const { container } = render(<PropertyField kind="color" label="Fill" value="#ffffff" onChange={() => {}} />);
    expect(container.querySelector('input[type="color"]')).toHaveAccessibleName('Fill');
  });

  it("names checkbox field's box after its label", () => {
    render(<PropertyField kind="boolean" label="Visible" value={false} onChange={() => {}} />);
    expect(screen.getByRole('checkbox', { name: 'Visible' })).toBeInTheDocument();
  });

  it("names toggle field's segments after their options", () => {
    render(<PropertyField kind="enum" control="toggle" label="Align" value="a" options={options} onChange={() => {}} />);
    expect(screen.getByRole('radio', { name: 'A' })).toBeInTheDocument();
  });

  it("names toggle field's group after its label", () => {
    render(<PropertyField kind="enum" control="toggle" label="Align" value="a" options={options} onChange={() => {}} />);
    expect(screen.getByRole('radiogroup', { name: 'Align' })).toBeInTheDocument();
  });

  // The help button is labelable and comes first, so the row's <label> labels it instead.
  describe('with a description', () => {
    it('slider field', () => {
      render(<PropertyField kind="number" control="slider" label="Opacity" description="d" value={10} min={0} max={100} onChange={() => {}} />);
      expect(screen.getByRole('slider', { name: 'Opacity' })).toBeInTheDocument();
    });
    it('slider field readout', () => {
      render(<PropertyField kind="number" control="slider" label="Opacity" description="d" value={10} min={0} max={100} onChange={() => {}} />);
      expect(screen.getByRole('spinbutton', { name: 'Opacity' })).toBeInTheDocument();
    });
    it('number field', () => {
      render(<PropertyField kind="number" label="N" description="d" value={1} onChange={() => {}} />);
      expect(screen.getByRole('spinbutton', { name: 'N' })).toBeInTheDocument();
    });
    it('text field', () => {
      render(<PropertyField kind="string" label="Name" description="d" value="foo" onChange={() => {}} />);
      expect(screen.getByRole('textbox', { name: 'Name' })).toBeInTheDocument();
    });
    it('select field', () => {
      render(<PropertyField kind="enum" label="Mode" description="d" value="a" options={options} onChange={() => {}} />);
      expect(trigger('Mode')).toBeInTheDocument();
    });
    it('color field', () => {
      const { container } = render(<PropertyField kind="color" label="Fill" description="d" value="#ffffff" onChange={() => {}} />);
      expect(container.querySelector('input[type="color"]')).toHaveAccessibleName('Fill');
    });
    it('checkbox field', () => {
      render(<PropertyField kind="boolean" label="Visible" description="d" value={false} onChange={() => {}} />);
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

  it("checkbox field toggles when its label's text is clicked", () => {
    const onChange = vi.fn();
    render(<PropertyField kind="boolean" label="Visible" description="d" value={false} onChange={onChange} />);
    fireEvent.click(screen.getByText('Visible'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  // `label.control` is the element a click on the label activates. getByLabelText cannot stand in:
  // it takes a label's first form control inside it and ignores `for`, so it always finds the ⓘ.
  const controlOf = (container: HTMLElement) => container.querySelector('label')?.control;

  it("text field's label is its field's", () => {
    const { container } = render(<PropertyField kind="string" label="Name" description="d" value="foo" onChange={() => {}} />);
    expect(controlOf(container)).toBe(screen.getByRole('textbox', { name: 'Name' }));
  });

  it("number field's label is its field's", () => {
    const { container } = render(<PropertyField kind="number" label="N" description="d" value={1} onChange={() => {}} />);
    expect(controlOf(container)).toBe(screen.getByRole('spinbutton', { name: 'N' }));
  });

  it("select field's label is its trigger's", () => {
    const { container } = render(
      <PropertyField kind="enum" label="Mode" description="d" value="a" options={options} onChange={() => {}} />,
    );
    expect(controlOf(container)).toBe(trigger('Mode'));
  });

  it("color field's label is its swatch's", () => {
    const { container } = render(
      <PropertyField kind="color" label="Fill" description="d" value="#ffffff" onChange={() => {}} />,
    );
    expect(controlOf(container)).toBe(container.querySelector('input[type="color"]'));
  });

  it("names color field's alpha slider after its label", () => {
    render(<PropertyField kind="color" label="Fill" description="d" value="#ffffff" alpha={0.5} onChange={() => {}} />);
    expect(screen.getByRole('slider', { name: 'Fill opacity' })).toBeInTheDocument();
  });
});
