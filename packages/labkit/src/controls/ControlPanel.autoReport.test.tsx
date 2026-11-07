import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { f } from '../config/builder';
import { resolveConfigSchema } from '../config/resolve';
import { ControlPanel } from './ControlPanel';

const hover = (label: string): void => {
  fireEvent.pointerMove(document.body, { pointerType: 'mouse' });
  fireEvent.pointerEnter(screen.getByText(label), { pointerType: 'mouse' });
};

describe('<ControlPanel reported>', () => {
  it('quotes a reported value through the leaf display, for a row with no resolver', () => {
    render(
      <ControlPanel
        schema={resolveConfigSchema(
          f.schema({
            turn: f
              .number(0)
              .range(0, Math.PI)
              .unit({ suffix: '°', scale: Math.PI / 180 })
              .auto(),
          }),
          [],
        )}
        config={{ turn: 0 }}
        auto={new Set(['turn'])}
        reported={new Map([['turn', Math.PI / 2]])}
        setConfig={() => {}}
      />,
    );
    expect(screen.getByText('auto')).toBeInTheDocument();
    hover('Turn');
    expect(screen.getByRole('tooltip')).toHaveTextContent(/^auto 90°$/);
  });

  it('outranks the resolver, and pins at the reported value', async () => {
    const setConfig = vi.fn();
    const { container } = render(
      <ControlPanel
        schema={resolveConfigSchema(
          f.schema({
            gap: f
              .number(12)
              .range(0, 48)
              .auto(() => 18),
          }),
          [],
        )}
        config={{ gap: 12 }}
        auto={new Set(['gap'])}
        reported={new Map([['gap', 30]])}
        setConfig={setConfig}
      />,
    );
    expect(container.querySelector('input[type=range]')).toHaveValue('30');
    await userEvent.click(screen.getByRole('button', { name: 'Pin Gap' }));
    expect(setConfig).toHaveBeenCalledWith('gap', 30);
  });

  it('ignores a report for a pinned row', () => {
    const { container } = render(
      <ControlPanel
        schema={resolveConfigSchema(f.schema({ gap: f.number(12).range(0, 48).auto() }), [])}
        config={{ gap: 12 }}
        auto={new Set()}
        reported={new Map([['gap', 30]])}
        setConfig={() => {}}
      />,
    );
    expect(container.querySelector('input[type=range]')).toHaveValue('12');
    hover('Gap');
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('hands a custom renderer the reported value', () => {
    render(
      <ControlPanel
        schema={resolveConfigSchema(f.schema({ count: f.number(3).auto() }), [])}
        config={{ count: 3 }}
        auto={new Set(['count'])}
        reported={new Map([['count', 7]])}
        setConfig={() => {}}
        renderers={{ count: (ctx) => <output>{String(ctx.value)}</output> }}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('7');
  });
});
