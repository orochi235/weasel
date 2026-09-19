import { f } from '@weasel-js/labkit/config';
import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openChannel } from '../protocol/channel';
import { type CssVarReport, type FromFrame, stableStringify, type ToFrame } from '../protocol/messages';
import { describeSchema } from '../protocol/schema';
import { meta, story } from '../story/define';
import { loadNativeModule } from '../story/native';
import type { Decorator, LoadedStory } from '../story/types';
import { scanCssVars } from './cssVars';
import { type FrameSetup, startFrame } from './FrameController';

vi.mock('./cssVars', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./cssVars')>();
  return { ...actual, scanCssVars: vi.fn(actual.scanCssVars) };
});

async function flush() {
  await new Promise((r) => setTimeout(r, 0));
  await act(async () => {});
}

const counter = loadNativeModule(
  {
    default: meta({ title: 'Test/Counter' }),
    Counter: story({
      config: f.schema({ label: f.string('clicks'), gated: f.number(1).showIf((c) => c.label !== 'off') }),
      state: () => ({ n: 0 }),
      render: ({ config, state, setState, setConfig }) => (
        <div>
          <p data-testid="out">{`${config.label}:${state.n}`}</p>
          <button type="button" onClick={() => setState((s) => ({ n: s.n + 1 }))}>
            inc
          </button>
          <button type="button" onClick={() => setConfig('label', 'renamed')}>
            rename
          </button>
        </div>
      ),
    }),
  },
  '/x.stories.tsx',
  '/',
)[0]!;

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const fn of cleanups.splice(0)) act(() => fn());
});

function start(loaded: LoadedStory, setup?: FrameSetup) {
  const { port1, port2 } = new MessageChannel();
  const shell = openChannel<FromFrame, ToFrame>(port1);
  const frame = openChannel<ToFrame, FromFrame>(port2);
  const received: FromFrame[] = [];
  shell.on((msg) => received.push(msg));
  const container = document.createElement('div');
  document.body.append(container);
  const stop = startFrame({ story: loaded, channel: frame, container, ...(setup ? { setup } : {}) });
  cleanups.push(() => {
    stop();
    container.remove();
    shell.close();
    frame.close();
  });
  const of = <T extends FromFrame['type']>(type: T) =>
    received.filter((m): m is Extract<FromFrame, { type: T }> => m.type === type);
  return { shell, received, of };
}

const init = { type: 'init', config: { label: 'clicks', gated: 1 }, state: null, globals: {} } as const;

describe('startFrame', () => {
  it('sends ready first, carrying the described schema', async () => {
    const { received } = start(counter);
    await flush();
    expect(received[0]).toMatchObject({ type: 'ready', schema: describeSchema(counter.config) });
  });

  it('says it has rendered once, after init commits its first render, and not before', async () => {
    const { shell, of, received } = start(counter);
    await flush();
    expect(of('rendered')).toEqual([]);
    shell.send(init);
    await flush();
    expect(screen.getByTestId('out').textContent).toBe('clicks:0');
    expect(of('rendered')).toEqual([{ type: 'rendered' }]);
    expect(received.findIndex((m) => m.type === 'rendered')).toBeGreaterThan(received.findIndex((m) => m.type === 'ready'));
    shell.send({ type: 'config', config: { label: 'again', gated: 1 } });
    await flush();
    expect(of('rendered')).toHaveLength(1);
  });

  it('renders on init and seeds state when the trial has none', async () => {
    const { shell, of } = start(counter);
    shell.send(init);
    await flush();
    expect(screen.getByTestId('out').textContent).toBe('clicks:0');
    expect(of('setState')).toEqual([{ type: 'setState', state: { n: 0 } }]);
  });

  it('re-renders on a config message and answers for that config', async () => {
    const { shell, of } = start(counter);
    shell.send(init);
    await flush();
    const config = { label: 'hello', gated: 1 };
    shell.send({ type: 'config', config });
    await flush();
    expect(screen.getByTestId('out').textContent).toBe('hello:0');
    expect(of('answers').at(-1)?.answers.configKey).toBe(stableStringify(config));
  });

  it('answers hidden paths from the story schema', async () => {
    const { shell, of } = start(counter);
    shell.send(init);
    await flush();
    shell.send({ type: 'config', config: { label: 'off', gated: 1 } });
    await flush();
    expect(of('answers').at(-1)?.answers.hidden).toContain('gated');
  });

  it('applies setState locally at once and sends it', async () => {
    const { shell, of } = start(counter);
    shell.send(init);
    await flush();
    act(() => {
      fireEvent.click(screen.getByText('inc'));
    });
    expect(screen.getByTestId('out').textContent).toBe('clicks:1');
    await flush();
    expect(of('setState').at(-1)).toEqual({ type: 'setState', state: { n: 1 } });
  });

  it('sends setConfig without re-rendering by itself', async () => {
    const { shell, of } = start(counter);
    shell.send(init);
    await flush();
    act(() => {
      fireEvent.click(screen.getByText('rename'));
    });
    await flush();
    expect(of('setConfig')).toEqual([{ type: 'setConfig', path: 'label', value: 'renamed' }]);
    expect(screen.getByTestId('out').textContent).toBe('clicks:0');
  });

  it('replaces state on a state message and re-renders', async () => {
    const { shell } = start(counter);
    shell.send(init);
    await flush();
    shell.send({ type: 'state', state: { n: 5 } });
    await flush();
    expect(screen.getByTestId('out').textContent).toBe('clicks:5');
  });

  it('applies globals to the document and re-renders on init and on a globals message', async () => {
    const [themed] = loadNativeModule(
      {
        default: meta({ title: 'Test/Themed' }),
        Themed: story({ render: ({ globals }) => <p data-testid="mode">{String(globals.mode)}</p> }),
      },
      '/g.stories.tsx',
      '/',
    );
    const applyGlobals = vi.fn();
    const { shell } = start(themed!, { applyGlobals });
    shell.send({ type: 'init', config: {}, state: null, globals: { mode: 'light' } });
    await flush();
    expect(applyGlobals).toHaveBeenLastCalledWith({ mode: 'light' }, document.documentElement);
    expect(screen.getByTestId('mode').textContent).toBe('light');
    shell.send({ type: 'globals', globals: { mode: 'dark' } });
    await flush();
    expect(applyGlobals).toHaveBeenCalledTimes(2);
    expect(applyGlobals).toHaveBeenLastCalledWith({ mode: 'dark' }, document.documentElement);
    expect(screen.getByTestId('mode').textContent).toBe('dark');
  });

  it('faults, carrying the input count, when applying globals throws on init or on a globals message', async () => {
    const applyGlobals = vi.fn((globals: Record<string, unknown>) => {
      if (globals.mode === 'bad') throw new Error('no such mode');
    });
    const { shell, of } = start(counter, { applyGlobals });
    shell.send({ ...init, globals: { mode: 'bad' } });
    await flush();
    expect(of('fault')).toEqual([expect.objectContaining({ phase: 'render', message: 'no such mode', seq: 1 })]);
    shell.send({ type: 'globals', globals: { mode: 'dark' } });
    shell.send({ type: 'globals', globals: { mode: 'bad' } });
    await flush();
    expect(of('fault').at(-1)).toEqual(expect.objectContaining({ phase: 'render', message: 'no such mode', seq: 3 }));
    expect(of('fault')[0]?.stack).toContain('no such mode');
  });

  it('faults when a story’s initialState throws on init', async () => {
    const throwing: LoadedStory = {
      ...counter,
      initialState: () => {
        throw new Error('no initial state');
      },
    };
    const { shell, of } = start(throwing);
    shell.send(init);
    await flush();
    expect(of('fault')).toEqual([expect.objectContaining({ phase: 'render', message: 'no initial state', seq: 1 })]);
  });

  it('nests decorators setup outermost, then meta, then story', async () => {
    const wrap =
      (d: string): Decorator =>
      (inner) => <div data-d={d}>{inner()}</div>;
    const [decorated] = loadNativeModule(
      {
        default: meta({ title: 'Test/Decorated', decorators: [wrap('meta')] }),
        Decorated: story({ decorators: [wrap('story')], render: () => <p data-testid="content">content</p> }),
      },
      '/d.stories.tsx',
      '/',
    );
    const { shell } = start(decorated!, { decorators: [wrap('setup')] });
    shell.send({ type: 'init', config: {}, state: null, globals: {} });
    await flush();
    const chain: string[] = [];
    for (let el = screen.getByTestId('content').closest('[data-d]'); el; el = el.parentElement!.closest('[data-d]')) {
      chain.push(el.getAttribute('data-d')!);
    }
    expect(chain).toEqual(['story', 'meta', 'setup']);
  });

  it('reports a render throw as a fault and recovers on new input', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const [fragile] = loadNativeModule(
      {
        default: meta({ title: 'Test/Fragile' }),
        Fragile: story({
          config: f.schema({ ok: f.boolean(false) }),
          render: ({ config }) => {
            if (!config.ok) throw new Error('bad config');
            return <p data-testid="fine">fine</p>;
          },
        }),
      },
      '/y.stories.tsx',
      '/',
    );
    const { shell, of } = start(fragile!);
    shell.send({ type: 'init', config: { ok: false }, state: null, globals: {} });
    await flush();
    expect(of('fault')).toEqual([expect.objectContaining({ phase: 'render', message: 'bad config' })]);
    expect(document.querySelector('.fg-frame__fault')?.textContent).toContain('bad config');
    shell.send({ type: 'config', config: { ok: true } });
    await flush();
    expect(screen.getByTestId('fine')).toBeTruthy();
    vi.restoreAllMocks();
  });

  it('tags a render fault with the count of inputs the render had received', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const [picky] = loadNativeModule(
      {
        default: meta({ title: 'Test/Picky' }),
        Picky: story({
          config: f.schema({ v: f.string('ok') }),
          render: ({ config }) => {
            if (config.v === 'A') throw new Error('bad A');
            return <p data-testid="picky">{config.v}</p>;
          },
        }),
      },
      '/p.stories.tsx',
      '/',
    );
    const { shell, of } = start(picky!);
    shell.send({ type: 'init', config: { v: 'ok' }, state: null, globals: {} });
    shell.send({ type: 'config', config: { v: 'A' } });
    shell.send({ type: 'config', config: { v: 'B' } });
    await flush();
    expect(of('fault')).toEqual([expect.objectContaining({ phase: 'render', message: 'bad A', seq: 2 })]);
    expect(screen.getByTestId('picky').textContent).toBe('B');
    vi.restoreAllMocks();
  });

  it('runs play and reports success', async () => {
    const play = vi.fn();
    const withPlay: LoadedStory = { ...counter, play };
    const { shell, of } = start(withPlay);
    shell.send(init);
    await flush();
    shell.send({ type: 'play' });
    await flush();
    expect(play).toHaveBeenCalledWith(expect.objectContaining({ config: init.config, globals: {} }));
    expect(play.mock.calls[0]![0].canvasElement.textContent).toContain('clicks:0');
    expect(of('played')).toEqual([{ type: 'played', ok: true }]);
  });

  describe('CSS variables', () => {
    const [styled] = loadNativeModule(
      {
        default: meta({ title: 'Test/Styled' }),
        Styled: story({ render: () => <p style={{ color: 'var(--fg-t-ink)' }}>styled</p> }),
      },
      '/s.stories.tsx',
      '/',
    );
    const rootStyle = document.createElement('style');
    rootStyle.textContent = ':root { --fg-t-ink: red; }';
    const settle = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const empty = { type: 'init', config: {}, state: null, globals: {} } as const;
    const ink = (vars: CssVarReport[] | undefined) => vars?.find((v) => v.name === '--fg-t-ink');

    afterEach(() => rootStyle.remove());

    it('reports the vars the rendered story uses after init', async () => {
      document.head.append(rootStyle);
      const { shell, of } = start(styled!);
      shell.send(empty);
      await flush();
      expect(ink(of('vars').at(-1)?.vars)).toEqual({ name: '--fg-t-ink', value: 'red', overridden: false });
    });

    it('applies vars.set as an override, reports it, and drops it on a null value', async () => {
      document.head.append(rootStyle);
      const { shell, of } = start(styled!);
      shell.send(empty);
      await flush();
      shell.send({ type: 'vars.set', name: '--fg-t-ink', value: 'blue' });
      await flush();
      expect(document.head.querySelector('style[data-fg-overrides]')?.textContent).toContain('--fg-t-ink: blue;');
      expect(ink(of('vars').at(-1)?.vars)).toEqual({ name: '--fg-t-ink', value: 'blue', overridden: true });
      shell.send({ type: 'vars.set', name: '--fg-t-ink', value: null });
      await flush();
      expect(ink(of('vars').at(-1)?.vars)).toEqual({ name: '--fg-t-ink', value: 'red', overridden: false });
    });

    it('answers each vars.set with the last report, flag updated, and never rescans for it', async () => {
      document.head.append(rootStyle);
      const { shell, of } = start(styled!);
      shell.send(empty);
      await flush();
      await settle(150);
      const before = of('vars').length;
      vi.mocked(scanCssVars).mockClear();
      const values = ['#111111', '#222222', '#333333', null] as const;
      for (const value of values) {
        shell.send({ type: 'vars.set', name: '--fg-t-ink', value });
        await flush();
      }
      await settle(150);
      expect(scanCssVars).not.toHaveBeenCalled();
      const sent = of('vars').slice(before);
      expect(sent.map((m) => ink(m.vars)?.overridden)).toEqual([true, true, true, false]);
      expect(ink(sent.at(-1)?.vars)).toEqual({ name: '--fg-t-ink', value: 'red', overridden: false });
    });

    it('writes overrides under the scope the setup names', async () => {
      const { shell } = start(styled!, { cssVarsScope: '[data-fg-t-scope]' });
      shell.send(empty);
      shell.send({ type: 'vars.set', name: '--fg-t-ink', value: 'blue' });
      await flush();
      expect(document.head.querySelector('style[data-fg-overrides]')?.textContent).toMatch(
        /^:is\(\[data-fg-t-scope\]\):not\(#fg-overrides\) \{/,
      );
    });

    it('does not count vars.set as render input', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const [fragile] = loadNativeModule(
        {
          default: meta({ title: 'Test/Fragile2' }),
          Fragile2: story({
            render: () => {
              throw new Error('always');
            },
          }),
        },
        '/f.stories.tsx',
        '/',
      );
      const { shell, of } = start(fragile!);
      shell.send({ type: 'vars.set', name: '--fg-t-ink', value: 'blue' });
      shell.send(empty);
      await flush();
      expect(of('fault')).toEqual([expect.objectContaining({ phase: 'render', seq: 1 })]);
      vi.restoreAllMocks();
    });

    it('rescans once the document settles after a mutation', async () => {
      const { shell, of } = start(styled!);
      shell.send(empty);
      await flush();
      const late = document.createElement('style');
      late.textContent = '.late { color: var(--fg-t-late); }';
      document.head.append(late);
      await settle(150);
      late.remove();
      expect(of('vars').at(-1)?.vars.map((v) => v.name)).toContain('--fg-t-late');
    });

    it('rescans when an attribute a stylesheet selects on changes outside any input', async () => {
      const modes = document.createElement('style');
      modes.textContent = ':root { --fg-t-ink: red; } :root[data-wzl-mode="dark"] { --fg-t-ink: white; }';
      document.head.append(modes);
      const { shell, of } = start(styled!);
      shell.send(empty);
      await settle(150);
      expect(ink(of('vars').at(-1)?.vars)?.value).toBe('red');
      document.documentElement.setAttribute('data-wzl-mode', 'dark');
      await settle(150);
      document.documentElement.removeAttribute('data-wzl-mode');
      modes.remove();
      expect(ink(of('vars').at(-1)?.vars)?.value).toBe('white');
    });

    it('removes its override style when stopped', async () => {
      const { shell } = start(styled!);
      shell.send(empty);
      shell.send({ type: 'vars.set', name: '--fg-t-ink', value: 'blue' });
      await flush();
      for (const fn of cleanups.splice(0)) act(() => fn());
      expect(document.head.querySelector('style[data-fg-overrides]')).toBeNull();
    });
  });

  it('reports a throwing play', async () => {
    const withPlay: LoadedStory = {
      ...counter,
      play: async () => {
        throw new Error('assertion failed');
      },
    };
    const { shell, of } = start(withPlay);
    shell.send(init);
    await flush();
    shell.send({ type: 'play' });
    await flush();
    expect(of('played')).toEqual([{ type: 'played', ok: false, message: 'assertion failed' }]);
    expect(of('fault')).toEqual([expect.objectContaining({ phase: 'play', message: 'assertion failed' })]);
  });
});
