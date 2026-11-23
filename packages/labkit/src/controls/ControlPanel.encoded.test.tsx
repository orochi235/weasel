import { fireEvent, screen } from '@testing-library/react';
import type { PrefLeaf } from '@weasel-js/prefs';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { describe, expect, it, vi } from 'vitest';
import { f } from '../config/builder';
import { resolveConfigSchema } from '../config/resolve';
import { ControlPanel } from './ControlPanel';

const boolean = (name: string, encoding: object) =>
  ({ kind: 'boolean', name, description: '', default: false, encoding }) as unknown as PrefLeaf;

/** Stored as a pair when on, and as nothing when off: its default is the option `false`, not a stored value. */
const skew = boolean('Skew', {
  read: (v: unknown) => v !== undefined,
  write: (on: boolean) => (on ? [1, 0] : undefined),
});
/** Reads and writes the object it is a field of. */
const linked = boolean('Linked', {
  read: (_v: unknown, siblings?: Record<string, unknown>) => siblings?.lock === 'on',
  write: (on: boolean, siblings?: Record<string, unknown>) => `${on}:${String(siblings?.lock)}`,
});

function mount(members: Record<string, PrefLeaf>, config: Record<string, unknown>) {
  const setConfig = vi.fn();
  const schema = resolveConfigSchema(f.prefs({ name: '', members }), []);
  renderWithIcons(<ControlPanel schema={schema} config={config} setConfig={setConfig} />);
  return setConfig;
}

const checked = (name: string) =>
  (screen.getByRole('checkbox', { name }) as HTMLInputElement).checked;

describe('<ControlPanel> an encoded leaf', () => {
  it('reads a field holding nothing through its encoding, not its default', () => {
    mount({ 'pose.skew': skew }, { pose: {} });
    expect(checked('Skew')).toBe(false);
  });

  it('reads and writes against the object it is a field of', () => {
    const setConfig = mount(
      {
        'pose.linked': linked,
        'pose.lock': boolean('Lock', { read: () => true, write: () => 'on' }),
      },
      { pose: { lock: 'on' } },
    );
    expect(checked('Linked')).toBe(true);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Linked' }));
    expect(setConfig).toHaveBeenCalledWith('pose.linked', 'false:on');
  });
});
