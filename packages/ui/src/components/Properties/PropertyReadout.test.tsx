import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { PropertyControl, PropertyField } from './PropertyField';

afterEach(cleanup);

const noop = () => {};
const shown = (name: string) => screen.getByRole('status', { name }).textContent;

describe('a read-only field', () => {
  it('draws each kind as the words its control would show', () => {
    render(
      <>
        <PropertyControl kind="number" name="Width" value={12.5} step={0.5} unit="px" readOnly onChange={noop} />
        <PropertyControl kind="boolean" name="Snap" value={false} readOnly onChange={noop} />
        <PropertyControl kind="enum" name="Align" value="c" options={[{ value: 'l', label: 'Left' }, { value: 'c', label: 'Center' }]} readOnly onChange={noop} />
        <PropertyControl kind="color" name="Tint" value="#ff0000" readOnly onChange={noop} />
        <PropertyControl kind="paint" name="Fill" value={{ color: '#00ff00' }} readOnly onChange={noop} />
        <PropertyControl kind="string" name="Title" value="" readOnly onChange={noop} />
      </>,
    );
    expect(shown('Width')).toBe('12.5px');
    expect(shown('Snap')).toBe('Off');
    expect(shown('Align')).toBe('Center');
    expect(shown('Tint')).toBe('#ff0000');
    expect(shown('Fill')).toBe('#00ff00');
    expect(shown('Title')).toBe('—');
    expect(screen.queryByRole('spinbutton')).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('says Mixed for values that disagree', () => {
    render(<PropertyControl kind="number" name="Width" value={undefined} mixed readOnly onChange={noop} />);
    expect(shown('Width')).toBe('Mixed');
  });

  it('draws a slider as its value too, and its row’s label names it', () => {
    render(<PropertyField kind="number" control="slider" label="Blur" value={4} readOnly onChange={noop} />);
    expect(screen.queryByRole('slider')).toBeNull();
    expect(screen.getByLabelText('Blur').tagName).toBe('OUTPUT');
  });
});
