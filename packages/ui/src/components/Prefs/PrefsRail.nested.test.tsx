import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { PrefGroup } from '@weasel-js/prefs';
import { afterEach, expect, it, vi } from 'vitest';
import { PrefsForm } from './PrefsForm';

afterEach(cleanup);

const flag = (name: string) => ({ kind: 'boolean' as const, name, description: '', default: false });
const SCHEMA: PrefGroup = {
  name: 'Prefs',
  children: {
    canvas: { name: 'Canvas', children: { grid: { name: 'Grid', children: { on: flag('Show grid') } } } },
    export: { name: 'Export', children: { png: { name: 'PNG', children: { alpha: flag('Keep alpha') } } } },
  },
};

it('opens the page of a nested rail entry chosen while another page is open', () => {
  render(<PrefsForm layout="rail" schema={SCHEMA} onChange={() => {}} />);
  expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Canvas');
  fireEvent.click(screen.getByRole('button', { name: 'PNG' }));
  expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Export');
  expect(screen.getByText('Keep alpha')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'PNG' })).toHaveAttribute('aria-current', 'location');
});

it('reports the page a nested entry opens to a form whose section is controlled', () => {
  const onSectionChange = vi.fn();
  render(<PrefsForm layout="rail" schema={SCHEMA} onChange={() => {}} section="canvas" onSectionChange={onSectionChange} />);
  fireEvent.click(screen.getByRole('button', { name: 'PNG' }));
  expect(onSectionChange).toHaveBeenCalledWith('export');
});
