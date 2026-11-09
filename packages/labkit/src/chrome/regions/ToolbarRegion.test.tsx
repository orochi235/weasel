import { fireEvent, screen } from '@testing-library/react';
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

  it('keeps a disabled button with a reason reachable, and says why', () => {
    renderWithIcons(
      <ToolbarRegion
        contributions={[
          item('close', {
            item: {
              icon: Glyph,
              label: 'Close',
              disabled: true,
              disabledReason: 'Last one',
              onActivate: () => {},
            },
          }),
        ]}
        ctx={ctx}
      />,
    );
    const close = screen.getByRole('button', { name: 'Close' });
    expect(close).toHaveAttribute('aria-disabled', 'true');
    expect(close).toHaveAttribute('aria-description', 'Last one');
  });

  it('opens a menu item’s entries, built from the chrome context', () => {
    const run = vi.fn();
    const entries = vi.fn((c: TrialChromeContext) => [
      { kind: 'item' as const, key: 'a', label: `From ${c.trialId}`, run },
    ]);
    renderWithIcons(
      <ToolbarRegion
        contributions={[
          { id: 'load', region: 'toolbar', item: { kind: 'menu', label: 'Load', entries } },
        ]}
        ctx={ctx}
      />,
    );
    const button = screen.getByRole('button', { name: 'Load' });
    expect(button).toHaveAttribute('aria-haspopup', 'menu');
    expect(entries).not.toHaveBeenCalled();
    fireEvent.click(button, { detail: 1 });
    expect(entries).toHaveBeenCalledWith(ctx);
    fireEvent.click(screen.getByRole('menuitem', { name: 'From t1' }));
    expect(run).toHaveBeenCalledOnce();
  });

  it('draws a menu item with an icon as the glyph alone, named by its label', () => {
    renderWithIcons(
      <ToolbarRegion
        contributions={[
          {
            id: 'more',
            region: 'toolbar',
            item: { kind: 'menu', icon: Glyph, label: 'More', entries: [] },
          },
        ]}
        ctx={ctx}
      />,
    );
    const button = screen.getByRole('button', { name: 'More' });
    expect(button.textContent).not.toContain('More');
  });
});
