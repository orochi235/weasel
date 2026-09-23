import { f } from '@weasel-js/labkit/config';
import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openChannel } from '../../protocol/channel';
import type { FromFrame, ToFrame } from '../../protocol/messages';
import { describeSchema } from '../../protocol/schema';
import { meta, story } from '../../story/define';
import { loadNativeModule } from '../../story/native';
import type { IndexRender, LoadedStory } from '../../story/types';
import type { FrameSetup } from '../FrameController';
import { startIndex } from './startIndex';

async function flush() {
  await new Promise((r) => setTimeout(r, 0));
  await act(async () => {});
}

const stories = loadNativeModule(
  {
    default: meta({ title: 'Kit/Button' }),
    Primary: story({
      config: f.schema({ label: f.string('Save'), disabled: f.boolean(false) }),
      state: () => ({ n: 0 }),
      render: ({ config, state, setState }) => (
        <button type="button" disabled={config.disabled} onClick={() => setState((s) => ({ n: s.n + 1 }))}>
          {`${config.label}:${state.n}`}
        </button>
      ),
    }),
    Broken: story({
      render: () => {
        throw new Error('no button today');
      },
    }),
  },
  'Kit/Button',
);

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const fn of cleanups.splice(0)) act(() => fn());
  vi.restoreAllMocks();
});

function start(options: { render?: IndexRender; setup?: FrameSetup; loaded?: readonly LoadedStory[] } = {}) {
  const { port1, port2 } = new MessageChannel();
  const shell = openChannel<FromFrame, ToFrame>(port1);
  const frame = openChannel<ToFrame, FromFrame>(port2);
  const received: FromFrame[] = [];
  shell.on((msg) => received.push(msg));
  const container = document.createElement('div');
  document.body.append(container);
  const stop = startIndex({
    title: 'Kit/Button',
    description: 'Presses things.',
    stories: options.loaded ?? stories,
    descriptions: { 'kit-button--primary': 'The one to press.' },
    render: options.render ?? null,
    channel: frame,
    container,
    ...(options.setup ? { setup: options.setup } : {}),
  });
  cleanups.push(() => {
    stop();
    shell.close();
    frame.close();
    container.remove();
  });
  return { shell, received, container };
}

const init = async (shell: ReturnType<typeof start>['shell']) => {
  shell.send({ type: 'init', config: {}, state: null, globals: { mode: 'dark' } });
  await flush();
};

describe('startIndex', () => {
  it('says ready as a fullscreen page with no controls, and draws nothing before init', async () => {
    const { received, container } = start();
    await flush();
    expect(received[0]).toEqual({
      type: 'ready',
      schema: describeSchema(f.schema({})),
      layout: 'fullscreen',
      viewport: null,
    });
    expect(container.querySelector('.fg-index')).toBeNull();
  });

  it('heads the page with the component and shows each story with its description, then says it rendered', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { shell, received } = start();
    await init(shell);
    expect(screen.getByRole('heading', { level: 1, name: 'Button' })).toBeInTheDocument();
    expect(screen.getByText('Kit')).toBeInTheDocument();
    expect(screen.getByText('Presses things.')).toBeInTheDocument();
    const primary = screen.getByRole('region', { name: 'Primary' });
    expect(within(primary).getByText('The one to press.')).toBeInTheDocument();
    expect(received.some((m) => m.type === 'rendered')).toBe(true);
  });

  it('shows a story once per value of its boolean control, each interactive on its own', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { shell } = start();
    await init(shell);
    const row = screen.getByRole('region', { name: 'Disabled' });
    const [off, on] = within(row).getAllByRole('button') as [HTMLButtonElement, HTMLButtonElement];
    expect([off.disabled, on.disabled]).toEqual([false, true]);
    expect(within(row).getByText('true')).toBeInTheDocument();
    fireEvent.click(off);
    expect(off.textContent).toBe('Save:1');
    const main = within(screen.getByRole('region', { name: 'Primary' })).getAllByRole('button', { name: 'Save:0' });
    expect(main.length).toBeGreaterThan(0);
  });

  it('shows variants once per set of controls, under the first story that has it', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const twins = loadNativeModule(
      {
        default: meta({ title: 'Kit/Button' }),
        One: story({ config: f.schema({ on: f.boolean(false) }), render: ({ config }) => <i>{`one:${config.on}`}</i> }),
        Two: story({ config: f.schema({ on: f.boolean(true) }), render: ({ config }) => <i>{`two:${config.on}`}</i> }),
        Three: story({ config: f.schema({ size: f.enum('s', ['s', 'l']) }), render: () => <i>three</i> }),
      },
      'Kit/Button',
    );
    const { shell } = start({ loaded: twins });
    await init(shell);
    expect(within(screen.getByRole('region', { name: 'One' })).getByRole('region', { name: 'On' })).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Two' })).queryByRole('region', { name: 'On' })).toBeNull();
    expect(within(screen.getByRole('region', { name: 'Three' })).getByRole('region', { name: 'Size' })).toBeInTheDocument();
  });

  it('keeps a throwing story in its own cell instead of faulting the page', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { shell, received } = start();
    await init(shell);
    expect(within(screen.getByRole('region', { name: 'Broken' })).getByText('no button today')).toBeInTheDocument();
    expect(received.some((m) => m.type === 'fault')).toBe(false);
  });

  it('asks the shell to open a story', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { shell, received } = start();
    await init(shell);
    fireEvent.click(within(screen.getByRole('region', { name: 'Primary' })).getByRole('button', { name: 'Open' }));
    await flush();
    expect(received.at(-1)).toEqual({ type: 'open', id: 'kit-button--primary' });
  });

  it('applies the globals on init and again when they change', async () => {
    const applyGlobals = vi.fn();
    const { shell } = start({ setup: { applyGlobals }, loaded: stories.slice(0, 1) });
    await init(shell);
    shell.send({ type: 'globals', globals: { mode: 'light' } });
    await flush();
    expect(applyGlobals.mock.calls.map((call) => call[0])).toEqual([{ mode: 'dark' }, { mode: 'light' }]);
  });

  it("renders the component's own page with the generated page's parts", async () => {
    const render: IndexRender = ({ title, stories: all, Story, Variants }) => (
      <section aria-label="Custom">
        <h1>{`Custom ${title}`}</h1>
        <Story story={all[0] as LoadedStory} config={{ label: 'Go' }} label="go" />
        <Variants story={all[0] as LoadedStory} />
      </section>
    );
    const { shell } = start({ render, loaded: stories.slice(0, 1) });
    await init(shell);
    const custom = screen.getByRole('region', { name: 'Custom' });
    expect(within(custom).getByRole('heading', { name: 'Custom Kit/Button' })).toBeInTheDocument();
    expect(within(custom).getAllByRole('button', { name: 'Go:0' })).toHaveLength(1);
    expect(within(custom).getByRole('region', { name: 'Disabled' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
  });

  it('faults the frame when the page itself throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const render: IndexRender = () => {
      throw new Error('bad page');
    };
    const { shell, received } = start({ render });
    await init(shell);
    expect(received.find((m) => m.type === 'fault')).toMatchObject({ phase: 'render', message: 'bad page' });
  });
});
