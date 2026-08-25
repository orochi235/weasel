import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Legend } from '../index';

describe('legend public entry', () => {
  it('reaches a consumer from the package entry point alone', () => {
    const { container } = render(<Legend entries={[{ key: 'a', label: 'a', color: '#fff' }]} />);
    expect(container.querySelector('.lk-legend__row')).toBeInTheDocument();
  });
});
