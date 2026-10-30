import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { KitSettingsProvider } from '@weasel-js/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDLE_SETTLE_MS } from '../../useIdleSettle';
import { PropertyControl } from './PropertyField';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function Text({ onChange, settleWhenIdle }: { onChange: (s: string) => void; settleWhenIdle?: boolean }) {
  const [value, setValue] = useState('old');
  return (
    <PropertyControl
      kind="string"
      name="Title"
      value={value}
      settleWhenIdle={settleWhenIdle}
      onChange={(next) => {
        onChange(next);
        setValue(next);
      }}
    />
  );
}

function setup(settleWhenIdle?: boolean, kit = true) {
  const onChange = vi.fn();
  render(
    <KitSettingsProvider value={kit ? { typing: { settleWhenIdle: true } } : {}}>
      <Text onChange={onChange} settleWhenIdle={settleWhenIdle} />
    </KitSettingsProvider>,
  );
  const field = screen.getByRole('textbox', { name: 'Title' });
  field.focus();
  return { onChange, field };
}

const type = (field: HTMLElement, ...texts: string[]) => {
  for (const text of texts) fireEvent.change(field, { target: { value: text } });
};
const wait = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

describe('a text control settling when idle', () => {
  it('commits typed text once typing has been idle for the delay, and keeps the text as typed', () => {
    const { onChange, field } = setup();
    type(field, 'n', 'ne', 'new');
    wait(IDLE_SETTLE_MS - 1);
    expect(onChange).not.toHaveBeenCalled();
    wait(1);
    expect(onChange.mock.calls).toEqual([['new']]);
    expect(field).toHaveValue('new');
  });

  it('commits again after more typing, and Enter adds nothing once the text is committed', () => {
    const { onChange, field } = setup();
    type(field, 'new');
    wait(IDLE_SETTLE_MS);
    type(field, 'newer');
    wait(IDLE_SETTLE_MS);
    fireEvent.keyDown(field, { key: 'Enter' });
    fireEvent.blur(field);
    expect(onChange.mock.calls).toEqual([['new'], ['newer']]);
  });

  it('commits nothing pending once Escape drops the draft', () => {
    const { onChange, field } = setup();
    type(field, 'new');
    wait(IDLE_SETTLE_MS);
    type(field, 'newer');
    fireEvent.keyDown(field, { key: 'Escape' });
    wait(IDLE_SETTLE_MS);
    expect(onChange.mock.calls).toEqual([['new']]);
    expect(field).toHaveValue('new');
  });

  it('never commits while typing without the setting', () => {
    const { onChange, field } = setup(undefined, false);
    type(field, 'new');
    wait(IDLE_SETTLE_MS * 4);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('takes its own settleWhenIdle over the kit setting', () => {
    const { onChange, field } = setup(false);
    type(field, 'new');
    wait(IDLE_SETTLE_MS * 4);
    expect(onChange).not.toHaveBeenCalled();
    cleanup();
    const on = setup(true, false);
    type(on.field, 'new');
    wait(IDLE_SETTLE_MS);
    expect(on.onChange.mock.calls).toEqual([['new']]);
  });
});

describe('a number control settling when idle', () => {
  it('commits a typed number once typing has been idle', () => {
    const onChange = vi.fn();
    render(
      <KitSettingsProvider value={{ typing: { settleWhenIdle: true } }}>
        <PropertyControl kind="number" name="Time" value={0} onChange={onChange} />
      </KitSettingsProvider>,
    );
    const field = screen.getByRole('spinbutton', { name: 'Time' });
    field.focus();
    type(field, '1', '15', '150', '1500');
    wait(IDLE_SETTLE_MS);
    expect(onChange.mock.calls).toEqual([[1500]]);
  });
});
