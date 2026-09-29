import { Lab } from '@weasel-js/labkit';
import { f } from '@weasel-js/labkit/config';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { renderOutsideAct, renderThenAbandon } from '@weasel-js/react/testing/abandonRender';
import { describe, expect, it, vi } from 'vitest';
import { meta, story } from '../story/define';
import { loadNativeModule } from '../story/native';
import { documentInstrument } from './documentInstrument';
import { installResizeObserver } from './labHarness';
import { StoryGlobalsContext } from './StoryGlobalsContext';
import { StoryTrial } from './StoryTrial';

installResizeObserver();

const [counter] = loadNativeModule(
  {
    default: meta({ title: 'Test/Counter' }),
    Counter: story({
      config: f.schema({ label: f.string('clicks') }),
      state: (config) => ({ n: config.label.length }),
      render: ({ config, state, setState, setConfig, globals }) => (
        <>
          <button type="button" onClick={() => setState({ n: state.n + 1 })}>
            {config.label}: {state.n}
          </button>
          <button type="button" onClick={() => setConfig('label', 'taps')}>
            rename
          </button>
          <button type="button" onClick={() => setConfig('$globals.mode', 'dark')}>
            pin
          </button>
          <output>{String(globals.mode)}</output>
        </>
      ),
    }),
  },
  'Test/Counter',
);

/** The trial's half: config and state as the lab would hold them, with `setConfig` on a top-level path. */
function Harness({ onError }: { onError?: (error: unknown) => void }) {
  const [config, setConfigState] = useState<Record<string, unknown>>({ label: 'clicks', $globals: { mode: 'lab' } });
  const [state, setState] = useState<unknown>(null);
  const [calls, setCalls] = useState<[string, unknown][]>([]);
  const setConfig = (path: string, value: unknown) => {
    setCalls((prev) => [...prev, [path, value]]);
    setConfigState((prev) => ({ ...prev, [path]: value }));
  };
  return (
    <StoryGlobalsContext.Provider value={{ mode: 'light' }}>
      <StoryTrial
        story={counter!}
        setup={{}}
        ctx={{ config, state, setConfig, setState: (next) => setState(next) }}
        {...(onError ? { onError } : {})}
      />
      <pre data-testid="setConfig">{JSON.stringify(calls)}</pre>
    </StoryGlobalsContext.Provider>
  );
}

describe('StoryTrial', () => {
  it("seeds a null state from the story's own initial state, then renders from the trial's config and state", async () => {
    render(<Harness />);
    expect((await screen.findByRole('button', { name: 'clicks: 6' })).textContent).toBe('clicks: 6');
    fireEvent.click(screen.getByRole('button', { name: 'clicks: 6' }));
    expect(screen.getByRole('button', { name: 'clicks: 7' })).toBeInTheDocument();
    expect(screen.getByRole('status').textContent).toBe('light');
  });

  it("writes the story's setConfig through to the trial, except onto the pins the story cannot see", async () => {
    render(<Harness />);
    await screen.findByRole('button', { name: 'clicks: 6' });
    fireEvent.click(screen.getByRole('button', { name: 'rename' }));
    expect(screen.getByRole('button', { name: 'taps: 6' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'pin' }));
    expect(JSON.parse(screen.getByTestId('setConfig').textContent ?? '[]')).toEqual([['label', 'taps']]);
  });

  it('keeps a render throw inside the boundary, reports it, and retries on the next input', async () => {
    const [bad] = loadNativeModule(
      {
        default: meta({ title: 'Test/Bad' }),
        Bad: story({
          config: f.schema({ ok: f.boolean(false) }),
          render: ({ config }) => {
            if (!config.ok) throw new Error('not yet');
            return <p>fine</p>;
          },
        }),
      },
      'Test/Bad',
    );
    const onError = vi.fn();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    function Host() {
      const [ok, setOk] = useState(false);
      return (
        <>
          <StoryTrial story={bad!} setup={{}} ctx={{ config: { ok }, state: null, setConfig: () => {}, setState: () => {} }} onError={onError} />
          <button type="button" onClick={() => setOk(true)}>
            fix
          </button>
        </>
      );
    }
    try {
      render(<Host />);
      expect(screen.getByText('not yet')).toBeInTheDocument();
      expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'not yet' }));
      act(() => fireEvent.click(screen.getByRole('button', { name: 'fix' })));
      expect(screen.getByText('fine')).toBeInTheDocument();
    } finally {
      spy.mockRestore();
    }
  });

  it("keeps the story's own state through the first press in a lab, which activates the trial", async () => {
    const renders = vi.fn();
    const [local] = loadNativeModule(
      {
        default: meta({ title: 'Test/Local' }),
        // A component declared inside `render` is a new type on each call, so any extra call remounts it.
        Local: story({
          render: () => {
            renders();
            function Toggle() {
              const [on, setOn] = useState(false);
              return (
                <button type="button" onClick={() => setOn(true)}>
                  {on ? 'on' : 'off'}
                </button>
              );
            }
            return <Toggle />;
          },
        }),
      },
      'Test/Local',
    );
    const entry = { id: 'test-local--local', title: 'Test/Local', name: 'Local', exportName: 'Local', file: '/local.stories.tsx' };
    const instrument = documentInstrument({ entry, loaded: { kind: 'story', story: local! }, setup: {} });
    render(
      <StoryGlobalsContext.Provider value={{}}>
        <Lab instruments={[instrument]} defaultInstrument={entry.id} />
      </StoryGlobalsContext.Provider>,
    );
    const button = await screen.findByRole('button', { name: 'off' });
    const before = renders.mock.calls.length;
    act(() => {
      fireEvent.pointerDown(button);
      fireEvent.click(button);
    });
    expect(screen.getByRole('button', { name: 'on' })).toBe(button);
    expect(renders.mock.calls.length).toBe(before);
  });

  it("writes the story's setState and setConfig to the committed trial, not an abandoned render's", async () => {
    const trial = () => ({ setConfig: vi.fn(), setState: vi.fn() });
    const committed = trial();
    const abandoned = trial();
    const config = { label: 'clicks' };
    const state = { n: 1 };
    renderThenAbandon(committed, abandoned, (fns) => (
      <StoryGlobalsContext.Provider value={{}}>
        <StoryTrial story={counter!} setup={{}} ctx={{ config, state, ...fns }} />
      </StoryGlobalsContext.Provider>
    ));
    fireEvent.click(await screen.findByRole('button', { name: 'clicks: 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'rename' }));
    expect(abandoned.setState).not.toHaveBeenCalled();
    expect(abandoned.setConfig).not.toHaveBeenCalled();
    expect(committed.setState).toHaveBeenCalledWith({ n: 2 });
    expect(committed.setConfig).toHaveBeenCalledWith('label', 'taps');
  });

  it('does not retry a caught render for input a render React threw away', () => {
    const failures = vi.fn();
    const [bad] = loadNativeModule(
      {
        default: meta({ title: 'Test/Bad' }),
        Bad: story({
          config: f.schema({ ok: f.boolean(false) }),
          render: ({ config }) => {
            if (!config.ok) {
              failures();
              throw new Error('not yet');
            }
            return <p>fine</p>;
          },
        }),
      },
      'Test/Bad',
    );
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let bump!: () => void;
    function Trial({ config }: { config: { ok: boolean } }) {
      const [, set] = useState(0);
      bump = () => set((n) => n + 1);
      return <StoryTrial story={bad!} setup={{}} ctx={{ config, state: null, setConfig: () => {}, setState: () => {} }} />;
    }
    try {
      renderThenAbandon({ ok: false }, { ok: true }, (config) => <Trial config={config} />);
      const before = failures.mock.calls.length;
      // A re-render with the committed config, which has not changed.
      renderOutsideAct(bump);
      expect(failures.mock.calls.length).toBe(before);
    } finally {
      spy.mockRestore();
    }
  });
});
