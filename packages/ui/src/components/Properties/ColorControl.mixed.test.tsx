import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PropertyField } from './PropertyField';

describe('PropertyField color on a mixed selection', () => {
  it.each([true, 0.5])('reports a color pick without an opacity when alpha is %s', (alpha) => {
    const onChange = vi.fn();
    const onAlphaChange = vi.fn();
    render(
      <PropertyField kind="color" label="Tint" value={undefined} mixed alpha={alpha} onChange={onChange} onAlphaChange={onAlphaChange} />,
    );
    const swatch = screen.getByLabelText('Tint', { selector: 'input[type="color"]' });
    fireEvent.input(swatch, { target: { value: '#00ff00' } });
    fireEvent.blur(swatch);
    expect(onChange.mock.calls).toEqual([['#00ff00']]);
    expect(onAlphaChange).not.toHaveBeenCalled();
  });
});
