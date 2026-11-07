import { act, fireEvent, screen, within } from '@testing-library/react';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { describe, expect, it, vi } from 'vitest';
import { auto } from '../config/auto';
import { f } from '../config/builder';
import { resolveConfigSchema } from '../config/resolve';
import { ControlPanel } from './ControlPanel';

/** An auto row of `node` in a panel whose owner tracks the auto set, and the `setConfig` it writes through. */
const autoRow = (node: { label(name: string): { auto(): unknown } }) => {
  const setConfig = vi.fn();
  const schema = resolveConfigSchema(f.schema({ thing: node.label('Thing').auto() as never }), []);
  renderWithIcons(
    <ControlPanel schema={schema} config={{}} auto={new Set(['thing'])} setConfig={setConfig} />,
  );
  return setConfig;
};

const pinned = (setConfig: ReturnType<typeof vi.fn>, value: unknown): void => {
  expect(setConfig).toHaveBeenCalledWith('thing', value);
  expect(setConfig).not.toHaveBeenCalledWith('thing', auto);
};

describe('an auto row keeps its control live, and an edit pins it', () => {
  it('a slider, reachable by role, pins on a drag', () => {
    const setConfig = autoRow(f.number(3).range(0, 8).slider());
    const slider = screen.getByRole('slider', { name: 'Thing' });
    expect(slider).toHaveValue('3');
    fireEvent.change(slider, { target: { value: '5' } });
    pinned(setConfig, 5);
  });

  // A log track: a linear one leaves its arrow keys to the native input, which jsdom does not step.
  it('a slider takes the keyboard while its readout is the word, and pins on an arrow key', () => {
    const setConfig = autoRow(f.number(4).range(1, 64).scale('log').slider());
    const slider = screen.getByRole('slider', { name: 'Thing' });
    expect(slider).not.toHaveAttribute('tabindex', '-1');
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    pinned(setConfig, 5);
  });

  it('a typed number pins on commit', () => {
    const setConfig = autoRow(f.number(3).range(0, 8).input());
    const box = screen.getByRole('spinbutton', { name: 'Thing' });
    fireEvent.change(box, { target: { value: '6' } });
    fireEvent.blur(box);
    pinned(setConfig, 6);
  });

  it('a checkbox pins on a toggle', () => {
    const setConfig = autoRow(f.boolean(true));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Thing' }));
    pinned(setConfig, false);
  });

  it('an enum menu pins on a pick', () => {
    const setConfig = autoRow(f.enum('a', ['a', 'b']));
    const trigger = screen.getByRole('button', { name: 'a Thing' });
    act(() => {
      fireEvent.click(trigger);
    });
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'b' }));
    pinned(setConfig, 'b');
  });

  it.each([
    ['radio', f.enum('a', ['a', 'b']).radio()],
    ['toggle', f.enum('a', ['a', 'b']).toggle()],
  ])('a %s group pins on a pick', (_kind, node) => {
    const setConfig = autoRow(node);
    fireEvent.click(screen.getByRole('radio', { name: 'b' }));
    pinned(setConfig, 'b');
  });

  it('a text field pins on commit', () => {
    const setConfig = autoRow(f.string('hi'));
    const box = screen.getByRole('textbox', { name: 'Thing' });
    expect(box).toHaveValue('hi');
    fireEvent.change(box, { target: { value: 'yo' } });
    fireEvent.blur(box);
    pinned(setConfig, 'yo');
  });

  it('a color pins on a pick', () => {
    const setConfig = autoRow(f.color('#3a86ff'));
    fireEvent.input(screen.getByLabelText('Thing', { selector: 'input[type=color]' }), {
      target: { value: '#00ff00' },
    });
    pinned(setConfig, '#00ff00');
  });

  it('leaves auto on an edit in a panel that keeps the auto set itself', () => {
    const setConfig = vi.fn();
    const schema = resolveConfigSchema(f.schema({ gap: f.number(12).range(0, 48).auto() }), []);
    renderWithIcons(<ControlPanel schema={schema} config={{ gap: 12 }} setConfig={setConfig} />);
    const label = screen.getByRole('button', { name: 'Pin Gap' });
    fireEvent.click(label);
    expect(label).toHaveAttribute('aria-pressed', 'false');
    fireEvent.change(screen.getByRole('slider', { name: 'Gap' }), { target: { value: '30' } });
    expect(setConfig).toHaveBeenCalledWith('gap', 30);
    expect(screen.getByRole('button', { name: 'Pin Gap' })).toHaveAttribute('aria-pressed', 'true');
  });
});
