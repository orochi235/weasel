import { act, fireEvent, screen } from '@testing-library/react';
import { type Action, useActionsRegistry } from '@weasel-js/core';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import { useEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { TrialContribution } from '../chrome/types';
import { icon } from '../icons.gen';
import type { Instrument } from '../instrument/types';
import { Lab } from '../lab/Lab';
import { createTrialActions } from './TrialScope';

const ran = vi.fn();
const ping: Action = {
  id: 'ping',
  label: 'Ping',
  invoker: {
    timing: 'immediate',
    run: (_deps, params) => {
      ran(params);
      return undefined;
    },
  },
};

function RegistersPing() {
  const registry = useActionsRegistry();
  useEffect(() => registry?.register(ping), [registry]);
  return null;
}

const pinging: Instrument = {
  name: 'Pinging',
  initialState: () => ({}),
  render: () => <RegistersPing />,
};

describe("a trial's runAction", () => {
  it("runs an action the trial's own content registered, from the chrome", async () => {
    const results: boolean[] = [];
    const command: TrialContribution = {
      id: 'ping-command',
      region: 'toolbar',
      item: {
        icon: icon('ui:add'),
        label: 'Ping it',
        onActivate: (ctx) => {
          results.push(ctx.runAction('ping', { n: 1 }), ctx.runAction('missing'));
        },
      },
    };
    await renderSettled(<Lab title="T" instruments={[pinging]} chrome={[command]} />, {
      wrapper: withIcons,
    });
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Ping it' }));
    });
    expect(ran).toHaveBeenCalledWith({ n: 1 });
    expect(results).toEqual([true, false]);
  });

  it('runs nothing once the registry it held is released', () => {
    const actions = createTrialActions();
    const trigger = vi.fn(() => true);
    const release = actions.attach({ trigger });
    expect(actions.run('a')).toBe(true);
    release();
    expect(actions.run('a')).toBe(false);
  });
});
