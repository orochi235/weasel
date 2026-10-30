import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { KitSettingsProvider, type KitSettingsOverrides } from '@weasel-js/react';
import { IDLE_SETTLE_MS } from '../../useIdleSettle';
import { UnitField, type UnitFieldProps } from './UnitField';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const CM = { mm: 0.1, cm: 1 };

function Host({ onChange, ...props }: Partial<UnitFieldProps> & { onChange: (n: number) => void }) {
  const [value, setValue] = useState(5);
  return (
    <UnitField
      value={value}
      accepts={CM}
      aria-label="Width"
      {...props}
      onChange={(n) => {
        onChange(n);
        setValue(n);
      }}
    />
  );
}

function setup(props: Partial<UnitFieldProps> = {}, settings: KitSettingsOverrides = { typing: { settleWhenIdle: true } }) {
  const onChange = vi.fn();
  render(
    <KitSettingsProvider value={settings}>
      <Host onChange={onChange} {...props} />
    </KitSettingsProvider>,
  );
  const field = screen.getByRole('spinbutton', { name: 'Width' });
  field.focus();
  return { onChange, field };
}

const type = (field: HTMLElement, ...texts: string[]) => {
  for (const text of texts) fireEvent.change(field, { target: { value: text } });
};
const wait = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

describe('UnitField settling when idle', () => {
  it('commits typed text once typing has been idle for the delay, and keeps the text as typed', () => {
    const { onChange, field } = setup();
    type(field, '1', '15');
    wait(IDLE_SETTLE_MS - 1);
    expect(onChange).not.toHaveBeenCalled();
    wait(1);
    expect(onChange.mock.calls).toEqual([[15]]);
    expect(field).toHaveValue('15');
    expect(field).toHaveFocus();
  });

  it('commits again after more typing, and blur adds nothing once the text is committed', () => {
    const { onChange, field } = setup();
    type(field, '15');
    wait(IDLE_SETTLE_MS);
    type(field, '150', '1500');
    wait(IDLE_SETTLE_MS);
    fireEvent.blur(field);
    expect(onChange.mock.calls).toEqual([[15], [1500]]);
  });

  it('waits the idle delay the kit settings give', () => {
    const { onChange, field } = setup({}, { typing: { settleWhenIdle: true, idleMs: 200 } });
    type(field, '7');
    wait(200);
    expect(onChange.mock.calls).toEqual([[7]]);
  });

  it('commits when idle with no setting given', () => {
    const { onChange, field } = setup({}, {});
    type(field, '15');
    wait(IDLE_SETTLE_MS);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('never commits while typing with the setting off', () => {
    const { onChange, field } = setup({}, { typing: { settleWhenIdle: false } });
    type(field, '15');
    wait(IDLE_SETTLE_MS * 4);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('takes its own settleWhenIdle over the kit setting', () => {
    const { onChange, field } = setup({ settleWhenIdle: false });
    type(field, '15');
    wait(IDLE_SETTLE_MS * 4);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('leaves text it cannot read, or a value outside its bounds, for blur to settle', () => {
    const { onChange, field } = setup({ minValue: 100 });
    type(field, '1');
    wait(IDLE_SETTLE_MS);
    type(field, '1c');
    wait(IDLE_SETTLE_MS);
    expect(onChange).not.toHaveBeenCalled();
    expect(field).toHaveValue('1c');
  });

  it('leaves an offset for blur, so a pause does not apply it twice', () => {
    const { onChange, field } = setup();
    type(field, '+=2');
    wait(IDLE_SETTLE_MS);
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.blur(field);
    expect(onChange.mock.calls).toEqual([[7]]);
  });

  it('puts back the value it last committed on Escape', () => {
    const onInput = vi.fn();
    const { onChange, field } = setup({ onInput });
    type(field, '15');
    wait(IDLE_SETTLE_MS);
    type(field, '150');
    fireEvent.keyDown(field, { key: 'Escape' });
    expect(onChange.mock.calls).toEqual([[15]]);
    expect(onInput.mock.calls.at(-1)).toEqual([15]);
    expect(field).toHaveValue('15');
  });
});
