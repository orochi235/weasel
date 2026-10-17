import { fireEvent, render, screen } from '@testing-library/react';
import { KitSettingsProvider } from '@weasel-js/react';
import { PARAMS_TEXT_WAIT_MS } from '@weasel-js/ui';
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

describe('<ControlPanel> text under kit settings', () => {
  it('waits the lab default with no provider', () => {
    const setConfig = vi.fn();
    render(<ControlPanel fields={fields} config={{ t: '' }} setConfig={setConfig} />);
    typeAndWait(PARAMS_TEXT_WAIT_MS.lab - 1);
    expect(setConfig).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(setConfig).toHaveBeenCalledWith('t', 'a');
  });

  it('waits params.lab.textWaitMs where a provider sets it', () => {
    const setConfig = vi.fn();
    render(
      <KitSettingsProvider value={{ params: { lab: { textWaitMs: 20 } } }}>
        <ControlPanel fields={fields} config={{ t: '' }} setConfig={setConfig} />
      </KitSettingsProvider>,
    );
    typeAndWait(20);
    expect(setConfig).toHaveBeenCalledWith('t', 'a');
  });
});
