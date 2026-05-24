import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ModeStatusIndicator } from './ModeStatusIndicator';

describe('ModeStatusIndicator', () => {
  it('renders nothing in normal mode', () => {
    const { container } = render(<ModeStatusIndicator modeId="normal" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the display name in non-normal modes', () => {
    render(<ModeStatusIndicator modeId="path-edit" />);
    expect(screen.getByText(/path edit/i)).toBeTruthy();
  });
});
