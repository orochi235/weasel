import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { VertexColorsDemo } from '../VertexColorsDemo';

describe('VertexColorsDemo', () => {
  it('mounts and renders a canvas', () => {
    const { container } = render(<VertexColorsDemo />);
    expect(container.querySelector('canvas')).toBeTruthy();
  });
});
