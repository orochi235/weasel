import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ToolOptionsBar } from './ToolOptionsBar';

describe('ToolOptionsBar', () => {
  it('renders its label and children', () => {
    render(
      <ToolOptionsBar label="Text">
        <button>B</button>
      </ToolOptionsBar>,
    );
    expect(screen.getByRole('toolbar', { name: /text/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'B' })).toBeInTheDocument();
  });

  it('renders as an empty reserved row with no children', () => {
    const { container } = render(<ToolOptionsBar />);
    expect(container.firstElementChild).toBeInTheDocument();
  });
});
