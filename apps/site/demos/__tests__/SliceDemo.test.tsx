import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SliceDemo } from '../SliceDemo';
import { renderWithIcons } from '../../testIcons';

afterEach(() => {
  delete window.__weaselTest;
});

describe('SliceDemo', () => {
  it("draws its tool palette from the canvas's tools in scope, the knife active", async () => {
    renderWithIcons(<SliceDemo />);
    const knife = await screen.findByRole('button', { name: /slice/i });
    expect(knife).toHaveAttribute('aria-current', 'true');
  });
});
