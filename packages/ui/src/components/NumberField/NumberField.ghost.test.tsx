import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NumberField } from './NumberField';
import s from './NumberField.module.css';

describe('NumberField ghost', () => {
  it('paints the frame by default', () => {
    const { container } = render(<NumberField aria-label="n" value={1} onChange={() => {}} />);
    const frame = container.querySelector(`.${s.frame}`);
    expect(frame).not.toBeNull();
    expect(frame?.className.split(' ')).not.toContain(s.ghost);
  });

  it('adds the ghost class when asked', () => {
    const { container } = render(
      <NumberField aria-label="n" value={1} ghost onChange={() => {}} />,
    );
    const frame = container.querySelector(`.${s.frame}`);
    expect(frame?.className.split(' ')).toContain(s.ghost);
  });
});
