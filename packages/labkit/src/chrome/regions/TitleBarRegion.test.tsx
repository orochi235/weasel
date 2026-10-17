import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { icon } from '../../icons.gen';
import type { TrialChromeContext, TrialContribution } from '../types';
import { TitleBarRegion } from './TitleBarRegion';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';

const Glyph = icon('ui:add');
const ctx = { trialId: 't1', saveSnapshot: vi.fn() } as unknown as TrialChromeContext;

function item(id: string, over: Partial<TrialContribution> = {}): TrialContribution {
  return {
    id,
    region: 'titlebar',
    item: { icon: Glyph, label: id, onActivate: () => {} },
    ...over,
  } as TrialContribution;
}

describe('TitleBarRegion', () => {
  it('renders nothing when it has nothing for its placement', () => {
    const { container } = renderWithIcons(<TitleBarRegion contributions={[item('lead')]} ctx={ctx} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('takes the contributions that set `end` into the actions span', () => {
    const { container } = renderWithIcons(
      <TitleBarRegion contributions={[item('lead'), item('close', { end: true })]} ctx={ctx} />,
    );
    expect(container.querySelector('.lk-trial__titlebar-actions')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'close' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'lead' })).toBeNull();
  });

  it('takes the rest into the lead span', () => {
    const { container } = renderWithIcons(
      <TitleBarRegion
        placement="lead"
        contributions={[item('lead'), item('close', { end: true })]}
        ctx={ctx}
      />,
    );
    expect(container.querySelector('.lk-trial__titlebar-lead')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'lead' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'close' })).toBeNull();
  });

  it('hands onActivate the chrome context', () => {
    const onActivate = vi.fn();
    renderWithIcons(
      <TitleBarRegion
        contributions={[
          {
            id: 'go',
            region: 'titlebar',
            end: true,
            item: { icon: Glyph, label: 'Go', onActivate },
          },
        ]}
        ctx={ctx}
      />,
    );
    screen.getByRole('button', { name: 'Go' }).click();
    expect(onActivate).toHaveBeenCalledWith(ctx);
  });
});
