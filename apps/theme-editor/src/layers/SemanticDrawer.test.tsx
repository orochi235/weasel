import { cleanup, fireEvent, screen } from '@testing-library/react';
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

function renderDrawer(rule: Varying<SemanticRule>) {
  const onRule = vi.fn();
  const props = { name: 'x', row, axes, ramps: {}, semantics: ['x'], issues: [], onRule, onRevert: vi.fn(), onClose: vi.fn() };
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
});
