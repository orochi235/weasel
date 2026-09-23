import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NORMAL, PATH_EDIT } from '@weasel-js/modes';
import { ModeStatusIndicator } from './ModeStatusIndicator';

describe('ModeStatusIndicator', () => {
  it('renders nothing in normal mode', () => {
    const { container } = render(<ModeStatusIndicator mode={NORMAL} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the display name in non-normal modes', () => {
    render(<ModeStatusIndicator mode={PATH_EDIT} />);
    expect(screen.getByText(/path edit/i)).toBeTruthy();
  });
});
