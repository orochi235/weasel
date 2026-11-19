import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AxisDefs, Varying } from '@weasel-js/theme';
import type { SemanticRule } from '@weasel-js/theme/engine';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import type { SemanticRowView } from '../theme/semantics';
import { SemanticDrawer } from './SemanticDrawer';

const axes = {
  mode: { values: { dark: {}, light: {} }, default: 'dark' },
  density: { values: { comfortable: {}, compact: {} }, default: 'comfortable' },
} as unknown as AxisDefs;
const row: SemanticRowView = { name: 'x', summary: '', pinned: false, ownPin: false, cells: [], worst: null };

const type = (text: string) => {
  const field = screen.getByRole('textbox', { name: 'Value' });
  fireEvent.change(field, { target: { value: text } });
  fireEvent.blur(field);
};

function renderDrawer(rule: Varying<SemanticRule>, ramps: Readonly<Record<string, readonly string[]>> = {}) {
  const onRule = vi.fn();
  const props = { name: 'x', row, axes, ramps, semantics: ['x'], issues: [], onRule, onRevert: vi.fn(), onClose: vi.fn() };
  const view = renderWithIcons(<SemanticDrawer {...props} rule={rule} />);
  const rerender = (next: Varying<SemanticRule>) => view.rerender(<SemanticDrawer {...props} rule={next} />);
  return { onRule, rerender };
}

describe('<SemanticDrawer>', () => {
  afterEach(cleanup);

  it('keeps a numeric literal a number when it is edited', () => {
    const { onRule } = renderDrawer({ value: 0.5, type: 'number' } as SemanticRule);
    type('0.6');
    expect(onRule.mock.calls.at(-1)![0]).toEqual({ value: 0.6, type: 'number' });
  });

  it('shows a cubic-bezier literal as CSS writes it and keeps it four numbers when edited', () => {
    const { onRule } = renderDrawer({ value: [0.32, 0, 0.67, 0], type: 'cubicBezier' } as SemanticRule);
    const field = screen.getByRole('textbox', { name: 'Value' });
    expect(field).toHaveValue('cubic-bezier(0.32, 0, 0.67, 0)');
    type('cubic-bezier(0.32, 0, 0.67, 0.1)');
    expect(onRule.mock.calls.at(-1)![0]).toEqual({ value: [0.32, 0, 0.67, 0.1], type: 'cubicBezier' });
  });

  it('edits a branch of the rule again after Varies by is turned off and on', () => {
    const comfortable = { value: 'a' } as SemanticRule;
    const { onRule, rerender } = renderDrawer({ by: 'density', comfortable, compact: { value: 'b' } } as Varying<SemanticRule>);
    rerender(comfortable);
    rerender({ by: 'mode', dark: comfortable, light: comfortable } as Varying<SemanticRule>);
    expect(screen.queryByText(/has no comfortable branch/)).not.toBeInTheDocument();
    type('c');
    expect(onRule.mock.calls.at(-1)![0]).toEqual({ by: 'mode', dark: { value: 'c' }, light: comfortable });
  });

  it('keeps a step that varies by axis when the ramp changes, moving only a step the new ramp lacks', async () => {
    const ramps = { gray: ['100', '200', '300'], tint: ['200', '400'] };
    const { onRule } = renderDrawer({ ramp: 'gray', step: { by: 'density', comfortable: '200', compact: '300' } } as SemanticRule, ramps);
    await userEvent.click(screen.getByRole('button', { name: /Ramp$/ }));
    await userEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'tint' }));
    expect(onRule.mock.calls.at(-1)![0]).toEqual({ ramp: 'tint', step: { by: 'density', comfortable: '200', compact: '200' } });
  });

  it('keeps a plain step the new ramp also has', async () => {
    const { onRule } = renderDrawer({ ramp: 'gray', step: '400' } as SemanticRule, { gray: ['100', '400'], tint: ['200', '400'] });
    await userEvent.click(screen.getByRole('button', { name: /Ramp$/ }));
    await userEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'tint' }));
    expect(onRule.mock.calls.at(-1)![0]).toEqual({ ramp: 'tint', step: '400' });
  });
});
