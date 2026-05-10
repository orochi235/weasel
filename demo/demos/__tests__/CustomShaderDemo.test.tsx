import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { CustomShaderDemo } from '../CustomShaderDemo';

describe('CustomShaderDemo', () => {
  it('mounts without throwing', () => {
    const { container } = render(<CustomShaderDemo />);
    expect(container.querySelectorAll('canvas').length).toBeGreaterThanOrEqual(1);
  });
});
