import { render } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { CurveMarks } from './CurveMarks';

it('draws two identical marks without a duplicate key', () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const { container } = render(
      <CurveMarks
        marks={[{ kind: 'line', x: 0.5 }, { kind: 'line', x: 0.5 }, { kind: 'band', x: [0.1, 0.2] }, { kind: 'band', x: [0.1, 0.2] }]}
        width={100}
        height={40}
      />,
    );
    expect(container.querySelectorAll('svg > line')).toHaveLength(2);
    expect(container.querySelectorAll('svg > g')).toHaveLength(2);
    expect(error.mock.calls.flat().join(' ')).not.toMatch(/same key/);
  } finally {
    error.mockRestore();
  }
});
