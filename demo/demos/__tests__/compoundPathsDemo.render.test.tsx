import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { CompoundPathsDemo } from '../CompoundPathsDemo';

describe('CompoundPathsDemo', () => {
  it('mounts without throwing and renders a canvas', () => {
    // Smoke-only: catches JSX-parse-error / import-time crash regressions.
    // The demo is otherwise exercised manually; this test just guards the
    // module's render path so a future bad edit fails loudly here.
    const { container } = render(<CompoundPathsDemo />);
    const canvas = container.querySelector('canvas');
    expect(canvas).toBeTruthy();
    expect(canvas!.isConnected).toBe(true);
  });
});
