import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import type { PrefGroup } from '@weasel-js/prefs';
import { PrefsForm } from './PrefsForm';

// Whether an entry's control keeps a usable width beside its remove button, and whether an
// object entry's rows stay inside the entry, are facts of layout that jsdom has none of.

afterEach(cleanup);

const SCHEMA: PrefGroup = {
  name: 'Timing',
  children: {
    phases: {
      kind: 'list',
      name: 'Phases',
      description: 'Seconds each phase holds.',
      default: [0.5, 2, 0.25],
      item: { kind: 'number', name: 'Phase', description: '', default: 1, min: 0, step: 0.25 },
      minItems: 1,
    },
    stops: {
      kind: 'list',
      name: 'Stops',
      description: 'Where the ramp changes color.',
      default: [{ at: 0, color: '#1d4ed8' }, { at: 1, color: '#f59e0b' }],
      item: {
        kind: 'object',
        name: 'Stop',
        description: '',
        default: { at: 0.5, color: '#888888' },
        children: {
          at: { kind: 'number', name: 'At', description: '', default: 0.5, min: 0, max: 1, step: 0.05 },
          color: { kind: 'color', name: 'Color', description: '', default: '#888888' },
        },
      },
    },
    reset: {
      kind: 'action',
      name: 'Timing defaults',
      description: 'Put every phase back.',
      default: undefined,
      label: 'Reset',
      run: () => {},
    },
  },
};

test('a list entry gives its control the row and keeps its remove button beside it', async () => {
  await page.viewport(720, 800);
  render(
    <div data-testid="frame" style={{ width: 640 }}>
      <PrefsForm schema={SCHEMA} values={{}} onChange={() => {}} />
    </div>,
  );
  const frame = screen.getByTestId('frame').getBoundingClientRect();
  for (const name of ['Phase 1', 'Phase 3', 'Stop 2']) {
    const remove = screen.getByRole('button', { name: `Remove ${name}` });
    const entry = remove.closest('li')!;
    const box = entry.getBoundingClientRect();
    const control = entry.firstElementChild!.getBoundingClientRect();
    const button = remove.getBoundingClientRect();
    expect(control.width, name).toBeGreaterThan(120);
    expect(button.left, name).toBeGreaterThanOrEqual(control.right);
    // The box can hold its width while what is in it runs past, under the remove button.
    for (const inner of entry.firstElementChild!.querySelectorAll('input, button')) {
      expect(inner.getBoundingClientRect().right, name).toBeLessThanOrEqual(button.left);
    }
    expect(button.top, name).toBeGreaterThanOrEqual(box.top);
    expect(button.bottom, name).toBeLessThanOrEqual(box.bottom);
    expect(box.right, name).toBeLessThanOrEqual(frame.right);
  }
  // The object entry's own rows sit inside the entry.
  const at = screen.getAllByText('At')[0]!.getBoundingClientRect();
  const stop = screen.getByRole('button', { name: 'Remove Stop 1' }).closest('li')!.getBoundingClientRect();
  expect(at.top).toBeGreaterThanOrEqual(stop.top);
  expect(at.bottom).toBeLessThanOrEqual(stop.bottom);
  expect(screen.getByRole('button', { name: 'Reset' }).getBoundingClientRect().width).toBeGreaterThan(0);
});
