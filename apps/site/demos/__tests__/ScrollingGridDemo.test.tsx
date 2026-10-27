import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ScrollingGridDemo } from '../ScrollingGridDemo';

afterEach(cleanup);

describe('ScrollingGridDemo', () => {
  it('mounts its scrolling grid', () => {
    const { container } = render(<ScrollingGridDemo />);
    expect(container.querySelector('canvas')).not.toBeNull();
  });
});
