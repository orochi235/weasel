import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { IconsDemo } from '../IconsDemo';

afterEach(cleanup);

describe('IconsDemo', () => {
  it('lists the shape glyphs beside its own, and names the one picked', () => {
    render(<IconsDemo />);
    expect(screen.getByRole('button', { name: 'demo:spark' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'shape:diamond' }));
    expect(screen.getByText('shape:diamond', { selector: 'code' })).toBeTruthy();
    expect(screen.getByText('@weasel-js/icons')).toBeTruthy();
  });
});
