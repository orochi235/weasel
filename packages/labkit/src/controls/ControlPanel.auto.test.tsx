import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { auto } from '../config/auto';
import { f } from '../config/builder';
import { resolveConfigSchema } from '../config/resolve';
import { ControlPanel } from './ControlPanel';

describe('<ControlPanel> auto', () => {
  it('renders a label toggle whether or not it was given a set of auto paths', () => {
    render(
      <ControlPanel
        schema={resolveConfigSchema(f.schema({ gap: f.number(12).range(0, 48).auto() }), [])}
        config={{ gap: 12 }}
        setConfig={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: 'Pin Gap' })).toBeInTheDocument();
  });

  it('hands a custom renderer the auto state and a working toggle', async () => {
    const setConfig = vi.fn();
    render(
      <ControlPanel
        schema={resolveConfigSchema(f.schema({ gap: f.number(12).range(0, 48).auto() }), [])}
        config={{ gap: 12 }}
        auto={new Set(['gap'])}
        setConfig={setConfig}
        renderers={{
          gap: (ctx) => (
            <button type="button" onClick={() => ctx.setAuto(false)}>
              {ctx.auto ? 'is auto' : 'is pinned'}
            </button>
          ),
        }}
      />,
    );
    const control = screen.getByRole('button', { name: 'is auto' });
    await userEvent.click(control);
    expect(setConfig).toHaveBeenCalledWith('gap', 12);
  });

  it('reads out the bare word, resolver or not', () => {
    render(
      <ControlPanel
        schema={resolveConfigSchema(
          f.schema({
            gap: f
              .number(12)
              .auto(() => 18)
              .range(0, 48),
          }),
          [],
        )}
        config={{ gap: 12 }}
        auto={new Set(['gap'])}
        setConfig={() => {}}
      />,
    );
    expect(screen.getByText('auto')).toBeInTheDocument();
    expect(screen.queryByText(/auto · /)).toBeNull();
  });

  it('quotes what a pinned row would read as auto in its help tooltip, and nothing for a row with no resolver', () => {
    render(
      <ControlPanel
        schema={resolveConfigSchema(
          f.schema({
            size: f.number(40).range(0, 100),
            gap: f
              .number(12)
              .auto((c) => (c.size as number) / 3)
              .range(0, 48),
          }),
          [],
        )}
        config={{ size: 40, gap: 12 }}
        auto={new Set()}
        setConfig={() => {}}
      />,
    );
    const help = screen.getAllByText('ⓘ');
    expect(help).toHaveLength(1);
    fireEvent.keyDown(document.body, { key: 'Tab' });
    act(() => help[0]?.focus());
    expect(screen.getByRole('tooltip')).toHaveTextContent(/^auto 13\.3333$/);
    const described = document.querySelectorAll('[aria-describedby]:not([aria-hidden])');
    expect(described).toHaveLength(1);
    expect(described[0]).toHaveAccessibleDescription('auto 13.3333');
  });

  it('writes the sentinel when the dot turns a row auto', async () => {
    const setConfig = vi.fn();
    render(
      <ControlPanel
        schema={resolveConfigSchema(f.schema({ gap: f.number(12).range(0, 48).auto() }), [])}
        config={{ gap: 12 }}
        auto={new Set()}
        setConfig={setConfig}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Gap/ }));
    expect(setConfig).toHaveBeenCalledWith('gap', auto);
  });

  it('keeps the sentinel out of a config it is not given an auto set for', async () => {
    const setConfig = vi.fn();
    render(
      <ControlPanel
        schema={resolveConfigSchema(f.schema({ gap: f.number(12).range(0, 48).auto() }), [])}
        config={{ gap: 12 }}
        setConfig={setConfig}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Gap/ }));
    expect(setConfig).not.toHaveBeenCalled();
    expect(screen.getByText('auto')).toBeInTheDocument();
  });

  it('writes the pinned value back when the dot un-autos a row', async () => {
    const setConfig = vi.fn();
    render(
      <ControlPanel
        schema={resolveConfigSchema(f.schema({ gap: f.number(12).range(0, 48).auto() }), [])}
        config={{ gap: 24 }}
        auto={new Set(['gap'])}
        setConfig={setConfig}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Gap/ }));
    expect(setConfig).toHaveBeenCalledWith('gap', 24);
  });

  it('gives a row that never said auto no dot', () => {
    render(
      <ControlPanel
        schema={resolveConfigSchema(f.schema({ seed: f.number(1).range(0, 8) }), [])}
        config={{ seed: 1 }}
        auto={new Set()}
        setConfig={() => {}}
      />,
    );
    expect(screen.queryByRole('button', { name: /Seed/ })).toBeNull();
  });

  it('draws what the instrument reads when a resolver depends on another auto path', () => {
    // `width` is auto with no resolver, so the instrument sees `undefined` and
    // `gap` resolves from that. Re-running gap's resolver against the raw
    // config would instead read the pinned 640 and draw a number nobody got.
    const { container } = render(
      <ControlPanel
        schema={resolveConfigSchema(
          f.schema({
            width: f.number(640).auto(),
            gap: f
              .number(12)
              .range(0, 48)
              .auto((c) => (c.width === undefined ? 5 : (c.width as number) / 64)),
          }),
          [],
        )}
        config={{ width: 640, gap: 12 }}
        auto={new Set(['width', 'gap'])}
        setConfig={() => {}}
      />,
    );
    expect(container.querySelector('input[type=range]')).toHaveValue('5');
  });

  it('draws an auto control at the resolved value, not the value underneath it', () => {
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
        setConfig={() => {}}
      />,
    );
    expect(container.querySelector('input[type=range]')).toHaveValue('18');
  });

  it('pins at the value it was drawing, not the stale one underneath', async () => {
    const setConfig = vi.fn();
    render(
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
        setConfig={setConfig}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Pin Gap' }));
    expect(setConfig).toHaveBeenCalledWith('gap', 18);
  });

  // Every kind, because the panel wraps some rows before rendering them and a
  // wrapper that drops the auto props leaves that kind silently pinned.
  it.each([
    ['number', f.number(3).range(0, 8)],
    ['slider', f.number(3).range(0, 8).slider()],
    ['boolean', f.boolean(true)],
    ['enum', f.enum('a', ['a', 'b'])],
    ['radio', f.enum('a', ['a', 'b']).radio()],
    ['toggle', f.enum('a', ['a', 'b']).toggle()],
    ['string', f.string('hi')],
    ['color', f.color('#3a86ff')],
  ])('marks a %s row auto and gives it a label toggle', (_kind, node) => {
    const { container } = render(
      <ControlPanel
        schema={resolveConfigSchema(f.schema({ thing: node.label('Thing').auto() }), [])}
        config={{ thing: node.default }}
        auto={new Set(['thing'])}
        setConfig={() => {}}
      />,
    );
    expect(container.querySelector('[class*=rowAuto]')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Pin Thing' })).toBeInTheDocument();
  });
});
