import { cleanup, render, screen } from '@testing-library/react';
import { type Action, ActionsProvider } from '@weasel-js/core';
import { type PrefLeaf, pref } from '@weasel-js/prefs';
import { RegisterAction } from '@weasel-js/routing/testing/registerAction';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { f } from '../config/builder';
import { resolveConfigSchema } from '../config/resolve';
import { ControlRow } from './ControlRow';

afterEach(cleanup);

const act = (id: string, label: string): Action => ({
  id,
  label,
  group: 'arrange',
  invoker: { timing: 'immediate', run: () => {} },
});

function row(leaf: PrefLeaf, config: Record<string, unknown> = {}) {
  const resolved = resolveConfigSchema(f.schema({}), []);
  return render(
    <ActionsProvider>
      <RegisterAction action={act('front', 'Bring to front')} />
      <RegisterAction action={act('back', 'Send to back')} />
      <ControlRow
        path="x"
        leaf={leaf}
        resolved={resolved}
        config={config}
        shown={config}
        setConfig={vi.fn()}
        pack="auto"
      />
    </ActionsProvider>,
  );
}

describe('ControlRow actions and readouts', () => {
  it('reads an action leaf’s label once, on its button', () => {
    row(pref.action('front', { name: 'To front' }));
    expect(screen.getAllByText('To front')).toHaveLength(1);
  });

  it('draws an actions leaf as one button row per action', () => {
    const { container } = row(pref.actions('arrange', { name: 'Arrange' }));
    expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual([
      'Bring to front',
      'Send to back',
    ]);
    expect(container.querySelector('.lk-control-actions')).not.toBeNull();
    expect(screen.queryByText('Arrange')).toBeNull();
  });

  it('draws a readout leaf as its value under its label', () => {
    row({ ...pref.number('Width', 0, { control: 'slider' }), readout: true }, { x: 40 });
    expect(screen.getByRole('status', { name: 'Width' }).textContent).toBe('40');
    expect(screen.queryByRole('slider')).toBeNull();
  });
});
