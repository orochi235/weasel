import { fireEvent, render, screen } from '@testing-library/react';
import type { PrefLeaf, PrefSection } from '@weasel-js/prefs';
import { describe, expect, it, vi } from 'vitest';
import { f } from '../config/builder';
import { resolveConfigSchema } from '../config/resolve';
import { ControlPanel } from './ControlPanel';

const num = (name: string, extra: Partial<PrefLeaf> = {}): PrefLeaf =>
  ({ kind: 'number', name, description: '', default: 0, min: 0, ...extra }) as PrefLeaf;

// A box side whose lower limit the config holds beside it, as a scene node's does.
const floor = (side: string) => ({
  minAt: (read: (path: string) => unknown) => read(`data.floor.${side}`) as number | undefined,
});

const SCHEMA: PrefSection = {
  name: 'Box',
  members: {
    'pose.width': num('W', { ...floor('width'), pair: { with: 'pose.height', label: 'Size' } }),
    'pose.height': num('H', floor('height')),
    'pose.depth': num('D', floor('depth')),
  },
};

function panel() {
  const setConfig = vi.fn();
  render(
    <ControlPanel
      schema={resolveConfigSchema(f.prefs(SCHEMA), [])}
      config={{
        pose: { width: 50, height: 50, depth: 50 },
        data: { floor: { width: 30, height: 20, depth: 10 } },
      }}
      setConfig={setConfig}
    />,
  );
  return setConfig;
}

describe('a number leaf with a minAt, in a ControlPanel', () => {
  it('holds a value typed into a paired cell to the bound read from the config', () => {
    const setConfig = panel();
    fireEvent.change(screen.getByLabelText('H'), { target: { value: '5' } });
    expect(setConfig).toHaveBeenLastCalledWith('pose.height', 20);
  });

  it('holds a value typed into a row of its own the same way', () => {
    const setConfig = panel();
    fireEvent.change(screen.getByLabelText('D'), { target: { value: '5' } });
    expect(setConfig).toHaveBeenLastCalledWith('pose.depth', 10);
  });
});
