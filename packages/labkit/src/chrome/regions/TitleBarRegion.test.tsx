import { fireEvent, screen } from '@testing-library/react';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { describe, expect, it, vi } from 'vitest';
import { icon } from '../../icons.gen';
import type { TrialChromeContext, TrialContribution } from '../types';
import { TitleBarRegion } from './TitleBarRegion';

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
    const { container } = renderWithIcons(
      <TitleBarRegion contributions={[item('lead')]} ctx={ctx} />,
    );
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

  it('holds a pressed item down and draws a label it is asked to show', () => {
    renderWithIcons(
      <TitleBarRegion
        contributions={[
          item('pin', {
            end: true,
            item: {
              icon: Glyph,
              label: 'Pin',
              pressed: true,
              showLabel: true,
              onActivate: () => {},
            },
          }),
        ]}
        ctx={ctx}
      />,
    );
    const pin = screen.getByRole('button', { name: 'Pin' });
    expect(pin).toHaveAttribute('aria-pressed', 'true');
    expect(pin.textContent).toBe('Pin');
  });

  it('keeps a disabled item with a reason reachable, says why, and ignores a press', () => {
    const onActivate = vi.fn();
    renderWithIcons(
      <TitleBarRegion
        contributions={[
          item('close', {
            end: true,
            item: {
              icon: Glyph,
              label: 'Close trial',
              disabled: true,
              disabledReason: 'It is the last trial',
              onActivate,
            },
          }),
        ]}
        ctx={ctx}
      />,
    );
    const close = screen.getByRole('button', { name: 'Close trial' });
    expect(close).not.toBeDisabled();
    expect(close).toHaveAttribute('aria-disabled', 'true');
    expect(close).toHaveAttribute('aria-description', 'It is the last trial');
    expect(close).not.toHaveAttribute('title');
    close.click();
    expect(onActivate).not.toHaveBeenCalled();
  });

  it('keeps a press on any of its buttons, a held one too, from reaching the bar behind it', () => {
    const onBar = vi.fn();
    renderWithIcons(
      // biome-ignore lint/a11y/noStaticElementInteractions: stands in for the title bar's drag surface
      <div onPointerDown={onBar} onMouseDown={onBar}>
        <TitleBarRegion
          contributions={[
            item('go', { end: true }),
            item('held', {
              end: true,
              item: {
                icon: Glyph,
                label: 'Held',
                disabled: true,
                disabledReason: 'Why',
                onActivate: () => {},
              },
            }),
          ]}
          ctx={ctx}
        />
      </div>,
    );
    for (const name of ['go', 'Held']) {
      fireEvent.pointerDown(screen.getByRole('button', { name }));
      fireEvent.mouseDown(screen.getByRole('button', { name }));
    }
    expect(onBar).not.toHaveBeenCalled();
  });
});
