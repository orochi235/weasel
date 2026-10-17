import { screen } from '@testing-library/react';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { describe, expect, it, vi } from 'vitest';
import { icon } from '../../icons.gen';
import type { TrialChromeContext, TrialContribution } from '../types';
import { ToolbarRegion } from './ToolbarRegion';

const Glyph = icon('ui:add');

const ctx = { trialId: 't1' } as unknown as TrialChromeContext;

function item(id: string, over: Partial<TrialContribution> = {}): TrialContribution {
  return {
    id,
    region: 'toolbar',
    item: { icon: Glyph, label: id, onActivate: () => {} },
    ...over,
  } as TrialContribution;
}

describe('ToolbarRegion', () => {
  it('renders nothing when it has no contributions', () => {
    const { container } = renderWithIcons(<ToolbarRegion contributions={[]} ctx={ctx} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders one button per contribution, labelled', () => {
    renderWithIcons(<ToolbarRegion contributions={[item('undo'), item('redo')]} ctx={ctx} />);
    expect(screen.getByRole('button', { name: 'undo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'redo' })).toBeInTheDocument();
  });

  it('hands onActivate the chrome context', () => {
    const onActivate = vi.fn();
    renderWithIcons(
      <ToolbarRegion
        contributions={[
          { id: 'snap', region: 'toolbar', item: { icon: Glyph, label: 'Snap', onActivate } },
        ]}
        ctx={ctx}
      />,
    );
    screen.getByRole('button', { name: 'Snap' }).click();
    expect(onActivate).toHaveBeenCalledWith(ctx);
  });

  it('groups contributions sharing a group into one group element', () => {
    renderWithIcons(
      <ToolbarRegion
        contributions={[
          item('undo', { group: 'history' }),
          item('redo', { group: 'history' }),
          item('close', { group: 'trial' }),
        ]}
        ctx={ctx}
      />,
    );
    expect(screen.getAllByRole('group')).toHaveLength(2);
  });

  it('renders a render-escape contribution verbatim', () => {
    renderWithIcons(
      <ToolbarRegion
        contributions={[{ id: 'custom', region: 'toolbar', render: () => <b>custom</b> }]}
        ctx={ctx}
      />,
    );
    expect(screen.getByText('custom')).toBeInTheDocument();
  });

  it('disables a button whose item says so', () => {
    renderWithIcons(
      <ToolbarRegion
        contributions={[
          item('undo', {
            item: { icon: Glyph, label: 'Undo', disabled: true, onActivate: () => {} },
          }),
        ]}
        ctx={ctx}
      />,
    );
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });
});
