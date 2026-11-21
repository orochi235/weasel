import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import meta from './KeymapHint.stories';

const Open = meta.component!;

describe('KeymapHint Opened story', () => {
  it('titles the hint with its label arg, and follows the arg when it changes', () => {
    const { rerender } = render(<Open label="Loupe" />);
    expect(screen.getByRole('status')).toHaveTextContent('Loupe');
    rerender(<Open label="Magnifier" />);
    expect(screen.getByRole('status')).toHaveTextContent('Magnifier');
    expect(screen.getByRole('status')).not.toHaveTextContent('Loupe');
  });
});
