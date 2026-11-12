import { fireEvent, render, screen } from '@testing-library/react';
import { KitSettingsProvider } from '@weasel-js/react';
import { PARAMS_TEXT_WAIT_MS } from '@weasel-js/ui/components/Prefs';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ControlPanel } from './ControlPanel';
import type { ConfigField } from './types';

const fields: ConfigField[] = [{ key: 't', label: 'T', type: 'text', default: '' }];

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function typeAndWait(ms: number): void {
  fireEvent.change(screen.getByLabelText('T'), { target: { value: 'a' } });
  act(() => vi.advanceTimersByTime(ms));
}

describe('<ControlPanel> text drafts under kit settings', () => {
  it('waits the lab default with no provider', () => {
    const draftConfig = vi.fn();
    render(
      <ControlPanel
        fields={fields}
        config={{ t: '' }}
        setConfig={vi.fn()}
        draftConfig={draftConfig}
      />,
    );
    typeAndWait(PARAMS_TEXT_WAIT_MS.lab - 1);
    expect(draftConfig).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(draftConfig).toHaveBeenCalledWith('t', 'a');
  });

  it('waits params.lab.textWaitMs where a provider sets it', () => {
    const draftConfig = vi.fn();
    render(
      <KitSettingsProvider value={{ params: { lab: { textWaitMs: 20 } } }}>
        <ControlPanel
          fields={fields}
          config={{ t: '' }}
          setConfig={vi.fn()}
          draftConfig={draftConfig}
        />
      </KitSettingsProvider>,
    );
    typeAndWait(20);
    expect(draftConfig).toHaveBeenCalledWith('t', 'a');
  });
});

describe('<ControlPanel> params.lab.settles', () => {
  const counts: ConfigField[] = [{ key: 'n', label: 'N', type: 'number', default: 0 }];

  function typeNumber(settles?: { number: boolean }) {
    const draftConfig = vi.fn();
    const setConfig = vi.fn();
    const panel = (
      <ControlPanel
        fields={counts}
        config={{ n: 0 }}
        setConfig={setConfig}
        draftConfig={draftConfig}
      />
    );
    render(
      settles ? (
        <KitSettingsProvider value={{ params: { lab: { settles } } }}>{panel}</KitSettingsProvider>
      ) : (
        panel
      ),
    );
    const input = screen.getByRole('spinbutton', { name: 'N' });
    input.focus();
    fireEvent.change(input, { target: { value: '7' } });
    return { draftConfig, setConfig, input };
  }

  it('drafts a typed number with no provider', () => {
    expect(typeNumber().draftConfig).toHaveBeenCalledWith('n', 7);
  });

  it('writes a typed number only once it settles where a provider says so', () => {
    const { draftConfig, setConfig, input } = typeNumber({ number: true });
    expect(draftConfig).not.toHaveBeenCalled();
    fireEvent.blur(input);
    expect(setConfig.mock.calls).toEqual([['n', 7]]);
  });
});
