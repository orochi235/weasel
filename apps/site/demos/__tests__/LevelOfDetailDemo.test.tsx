import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { LevelOfDetailDemo } from '../LevelOfDetailDemo';

afterEach(cleanup);

describe('LevelOfDetailDemo', () => {
  it('mounts its diagram on a canvas', () => {
    const { container } = render(<LevelOfDetailDemo />);
    expect(container.querySelector('canvas')).not.toBeNull();
  });
});
