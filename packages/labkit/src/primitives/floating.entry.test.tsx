import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FloatingPanel, Legend } from '../index';

describe('floating public entry', () => {
  it('reaches a consumer from the package entry point alone', () => {
    const { container } = render(
      <FloatingPanel>
        <Legend entries={[{ key: 'a', label: 'a', color: '#fff' }]} />
      </FloatingPanel>,
    );
    expect(container.querySelector('.lk-floating-panel .lk-legend')).toBeInTheDocument();
  });
});
