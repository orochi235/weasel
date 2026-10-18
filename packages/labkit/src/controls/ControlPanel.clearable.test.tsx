import { fireEvent, screen } from '@testing-library/react';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { f } from '../config/builder';
import { resolveConfigSchema } from '../config/resolve';
import { ControlPanel } from './ControlPanel';

function mount(schema: ReturnType<typeof resolveConfigSchema>, config: Record<string, unknown>) {
  const setConfig = vi.fn();
  renderWithIcons(<ControlPanel schema={schema} config={config} setConfig={setConfig} />);
  return setConfig;
}

const empty = (input: HTMLElement) => {
  input.focus();
  fireEvent.change(input, { target: { value: '' } });
  fireEvent.blur(input);
};

describe('a clearable number', () => {
  it('writes undefined when its field is emptied and left, and shows its placeholder while unset', () => {
    const config = f.schema({ gap: f.number(4).clearable().placeholder('auto') });
    const schema = resolveConfigSchema(config);
    const setConfig = mount(schema, { gap: 4 });
    empty(screen.getByRole('spinbutton', { name: 'Gap' }));
    expect(setConfig.mock.calls).toEqual([['gap', undefined]]);
  });

  it('draws an unset value as an empty field, not as its default', () => {
    const schema = resolveConfigSchema(
      f.schema({ gap: f.number(4).clearable().placeholder('auto') }),
    );
    mount(schema, { gap: undefined });
    const input = screen.getByRole('spinbutton', { name: 'Gap' });
    expect(input).toHaveValue('');
    expect(input).toHaveAttribute('placeholder', 'auto');
  });

  it('starts unset when it is given no default', () => {
    const config = f.schema({ gap: f.number() });
    expectTypeOf(config.defaults().gap).toEqualTypeOf<number | undefined>();
    expect(config.defaults()).toEqual({ gap: undefined });
    const setConfig = mount(resolveConfigSchema(config), {});
    const input = screen.getByRole('spinbutton', { name: 'Gap' });
    expect(input).toHaveValue('');
    input.focus();
    fireEvent.change(input, { target: { value: '7' } });
    fireEvent.blur(input);
    expect(setConfig.mock.calls).toEqual([['gap', 7]]);
  });

  it('puts the value back in a number that is not clearable', () => {
    const setConfig = mount(resolveConfigSchema(f.schema({ gap: f.number(4) })), { gap: 4 });
    const input = screen.getByRole('spinbutton', { name: 'Gap' });
    empty(input);
    expect(setConfig).not.toHaveBeenCalled();
    expect(input).toHaveValue('4');
  });
});

describe('a number bounded on one side', () => {
  it('clamps to a minimum alone, and stays a typed field', () => {
    const setConfig = mount(resolveConfigSchema(f.schema({ gap: f.number(4).min(1) })), { gap: 4 });
    const input = screen.getByRole('spinbutton', { name: 'Gap' });
    expect(screen.queryByRole('slider')).toBeNull();
    input.focus();
    fireEvent.change(input, { target: { value: '-3' } });
    fireEvent.blur(input);
    expect(setConfig.mock.calls).toEqual([['gap', 1]]);
  });

  it('clamps to a maximum alone', () => {
    const setConfig = mount(resolveConfigSchema(f.schema({ gap: f.number(4).max(10) })), {
      gap: 4,
    });
    const input = screen.getByRole('spinbutton', { name: 'Gap' });
    input.focus();
    fireEvent.change(input, { target: { value: '30' } });
    fireEvent.blur(input);
    expect(setConfig.mock.calls).toEqual([['gap', 10]]);
  });
});
