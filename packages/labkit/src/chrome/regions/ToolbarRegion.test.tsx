import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ToolbarRegion } from './ToolbarRegion';
import type { TrialChromeContext, TrialContribution } from '../types';

const Glyph = () => <svg data-testid="glyph" />;

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
    const { container } = render(<ToolbarRegion contributions={[]} ctx={ctx} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders one button per contribution, labelled', () => {
    render(<ToolbarRegion contributions={[item('undo'), item('redo')]} ctx={ctx} />);
    expect(screen.getByRole('button', { name: 'undo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'redo' })).toBeInTheDocument();
  });

  it('fires onActivate on click', () => {
    const onActivate = vi.fn();
    render(
      <ToolbarRegion
        contributions={[
          { id: 'go', region: 'toolbar', item: { icon: Glyph, label: 'Go', onActivate } },
        ]}
        ctx={ctx}
      />,
    );
    screen.getByRole('button', { name: 'Go' }).click();
    expect(onActivate).toHaveBeenCalledOnce();
  });

  it('groups contributions sharing a group into one group element', () => {
    render(
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
    render(
      <ToolbarRegion
        contributions={[{ id: 'custom', region: 'toolbar', render: () => <b>custom</b> }]}
        ctx={ctx}
      />,
    );
    expect(screen.getByText('custom')).toBeInTheDocument();
  });

  it('disables a button whose item says so', () => {
    render(
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
