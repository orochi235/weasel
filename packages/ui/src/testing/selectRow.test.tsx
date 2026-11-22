import { render } from '@testing-library/react';
import { PropertyField } from '../components/Properties';
import { describe, expect, it } from 'vitest';
import { trigger } from './selectRow';

describe('trigger', () => {
  it('matches a label holding regex syntax as written', () => {
    render(<button type="button">Large Size (px)</button>);
    expect(trigger('Size (px)').textContent).toBe('Large Size (px)');
  });

  it('matches the label at the end of the name, not a longer label or a help button', () => {
    render(
      <>
        <button type="button">A Mode</button>
        <button type="button">B Mode select</button>
        <button type="button">C Submode</button>
        <button type="button">About Mode</button>
      </>,
    );
    expect(trigger('Mode').textContent).toBe('A Mode');
  });

  it("tells a select row from one whose label ends in the same words", () => {
    const options = [
      { value: 'a', label: 'Alpha' },
      { value: 'b', label: 'Normal' },
    ];
    render(
      <>
        <PropertyField kind="enum" control="select" label="Blend Mode" value="b" options={options} onChange={() => {}} />
        <PropertyField kind="enum" control="select" label="Mode" value="a" options={options} onChange={() => {}} />
      </>,
    );
    expect(trigger('Mode')).toHaveAccessibleName('Alpha Mode');
  });

  it('throws rather than open a longer label when the row is missing', () => {
    const options = [{ value: 'b', label: 'Normal' }];
    render(<PropertyField kind="enum" control="select" label="Blend Mode" value="b" options={options} onChange={() => {}} />);
    expect(() => trigger('Mode')).toThrow(/Mode/);
  });
});
