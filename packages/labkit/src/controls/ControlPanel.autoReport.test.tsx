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

  it("reads out a quoted leaf's reported value beside the word, through its display", () => {
    const { container } = render(
      <ControlPanel
        schema={resolveConfigSchema(
          f.schema({
            turn: f
              .number(0)
              .range(0, Math.PI)
              .unit({ suffix: '°', scale: Math.PI / 180 })
              .quote(),
          }),
          [],
        )}
        config={{ turn: 0 }}
        auto={new Set(['turn'])}
        reported={new Map([['turn', Math.PI / 2]])}
        setConfig={() => {}}
      />,
    );
    expect(container.querySelector('[class*=autoReadout_]')).toHaveTextContent(/^auto · 90°$/);
  });

  it("reads out a quoted leaf's resolved value, and the bare word while none is known", () => {
    const schema = resolveConfigSchema(
      f.schema({
        gap: f
          .number(12)
          .range(0, 48)
          .auto(() => 18)
          .quote(),
        count: f.number(3).range(1, 20).quote(),
      }),
      [],
    );
    const { container } = render(
      <ControlPanel
        schema={schema}
        config={{ gap: 12, count: 3 }}
        auto={new Set(['gap', 'count'])}
        setConfig={() => {}}
      />,
    );
    const readouts = container.querySelectorAll('[class*=readoutText]');
    expect([...readouts].map((r) => r.textContent)).toEqual(['auto · 18', 'auto']);
    expect(screen.getByRole('button', { name: 'Pin Count' })).toBeInTheDocument();
  });

  it('keeps an unquoted row to the bare word, reported or not', () => {
    render(
      <ControlPanel
        schema={resolveConfigSchema(f.schema({ gap: f.number(12).range(0, 48).auto() }), [])}
        config={{ gap: 12 }}
        auto={new Set(['gap'])}
        reported={new Map([['gap', 30]])}
        setConfig={() => {}}
      />,
    );
    expect(screen.getByText('auto')).toBeInTheDocument();
    expect(screen.queryByText(/auto · /)).toBeNull();
  });

  it('reads a reported null as no report', () => {
    const { container } = render(
      <ControlPanel
        schema={resolveConfigSchema(f.schema({ count: f.number(3).range(1, 20).quote() }), [])}
        config={{ count: 3 }}
        auto={new Set(['count'])}
        reported={new Map([['count', null]])}
        setConfig={() => {}}
      />,
    );
    expect(container.querySelector('[class*=readoutText]')).toHaveTextContent(/^auto$/);
  });
});
