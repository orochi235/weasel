import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { JobHandle } from '../job/types';
import { JobProgress } from './JobProgress';

const base: JobHandle = {
  status: 'running',
  done: 0,
  total: null,
  failures: [],
  error: null,
  start: () => {},
  cancel: () => {},
};

function parts(job: JobHandle) {
  const { container } = render(<JobProgress job={job} />);
  const track = container.querySelector<HTMLElement>('.lk-job__track');
  const fill = container.querySelector<HTMLElement>('.lk-job__fill');
  if (!track || !fill) throw new Error('no track');
  return { track, fill, container };
}

describe('JobProgress', () => {
  it('sweeps while a job with no total runs', () => {
    const { track } = parts({ ...base, done: 3 });
    expect(track).toHaveClass('lk-job__track--indeterminate');
  });

  it('stops sweeping once a job with no total finishes: a full bar', () => {
    const { track, fill } = parts({ ...base, done: 3, status: 'done' });
    expect(track).not.toHaveClass('lk-job__track--indeterminate');
    expect(fill.style.transform).toBe('scaleX(1)');
  });

  it('stops sweeping once a job with no total fails: an empty bar', () => {
    const { track, fill } = parts({ ...base, done: 3, status: 'error', error: 'boom' });
    expect(track).not.toHaveClass('lk-job__track--indeterminate');
    expect(fill.style.transform).toBe('scaleX(0)');
  });

  it('counts a failed item as handled, so a finished job with failures fills its bar', () => {
    const failures = [
      { index: 3, error: 'timed out' },
      { index: 91, error: 'bad input' },
    ];
    const { track, fill, container } = parts({
      ...base,
      status: 'done',
      done: 118,
      total: 120,
      failures,
    });
    expect(fill.style.transform).toBe('scaleX(1)');
    expect(track).toHaveAttribute('aria-valuenow', '120');
    expect(container.querySelector('.lk-job__count > span')).toHaveTextContent('120 / 120');
  });

  it('keeps a count past a revised total inside the bar range and the reserved width', () => {
    const { track, fill, container } = parts({ ...base, done: 130, total: 120 });
    expect(fill.style.transform).toBe('scaleX(1)');
    expect(track).toHaveAttribute('aria-valuenow', '130');
    expect(track).toHaveAttribute('aria-valuemax', '130');
    expect(container.querySelector('.lk-job__count-sizer')).toHaveTextContent('130 / 120');
  });
});
