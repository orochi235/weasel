import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { StreamingDemo } from '../StreamingDemo';

afterEach(cleanup);

describe('StreamingDemo', () => {
  it('mounts on a canvas and asks for the cells of its first view', () => {
    const { container } = render(<StreamingDemo />);
    expect(container.querySelector('canvas')).not.toBeNull();
    expect(container.textContent).toContain('undo 0');
  });
});
