import type { Meta, StoryObj } from '@storybook/react-vite';
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

const meta: Meta<typeof JobProgress> = {
  title: 'labkit/primitives/JobProgress',
  component: JobProgress,
};
export default meta;
type Story = StoryObj<typeof JobProgress>;

/** A job that reported a total drives a determinate bar. */
export const Determinate: Story = {
  args: { job: { ...base, done: 34, total: 120 } },
};

/** A job that never reports a total sweeps instead, so the bar says "working"
 *  without implying a position. */
export const Indeterminate: Story = { args: { job: { ...base, done: 34 } } };

export const WithFailures: Story = {
  args: {
    job: {
      ...base,
      done: 120,
      total: 120,
      status: 'done',
      failures: [
        { index: 3, error: 'timed out' },
        { index: 91, error: 'bad input' },
      ],
    },
  },
};

export const Failed: Story = {
  args: { job: { ...base, done: 12, total: 120, status: 'error', error: 'worker crashed' } },
};
