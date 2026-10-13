import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NumberField } from './NumberField';
import s from './NumberField.module.css';

// A proxy: jsdom resolves no CSS, so these read the class the component asks for, not the painted frame.
describe('NumberField ghost', () => {
  it('leaves the ghost class off by default', () => {
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
