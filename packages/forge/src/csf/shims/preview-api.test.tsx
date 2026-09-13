import { act, render, screen } from '@testing-library/react';
import { type ComponentType, type ReactNode, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { LoadedStory, StoryContext } from '../../story/types';
import { loadCsfModule } from '../loadCsfModule';
import { useArgs } from './preview-api';

describe('useArgs with values that cannot cross the port', () => {
  type Args = Record<string, unknown>;
  const original = () => 'original';

  /** A frame whose setConfig clones like a MessagePort, with decorators applied innermost first. */
  function mount(story: LoadedStory) {
    const sent: [string, unknown][] = [];
    function Host(): ReactNode {
      const [config, setAll] = useState(() => story.config.defaults() as Args);
      const ctx: StoryContext = {
        config,
        setConfig: (key, value) => {
          const copy = structuredClone(value);
          sent.push([key, value]);
          setAll((prev) => ({ ...prev, [key]: copy }));
        },
        state: null,
        setState: () => {},
        globals: {},
        title: story.title,
        name: story.name,
      };
      let inner: () => ReactNode = () => story.render(ctx);
      for (const decorate of story.decorators) {
        const wrapped = inner;
        inner = () => decorate(wrapped, ctx);
      }
      return inner();
    }
    render(<Host />);
    return sent;
  }

  const load = (annotations: Args) =>
    loadCsfModule(
      { default: { title: 'ui/Button', args: { n: 1, label: 'x', onClick: original } }, A: annotations },
      '/repo/Button.stories.tsx',
      '/repo',
    )[0] as LoadedStory;

  it('sends cloneable values and keeps the rest in the frame', () => {
    let captured: ReturnType<typeof useArgs> | undefined;
    const sent = mount(
      load({
        render: function Read() {
          captured = useArgs();
          return <p>{String(captured[0].n)}</p>;
        },
      }),
    );
    const next = () => 'next';
    act(() => captured?.[1]({ onClick: next, n: 2 }));
    expect(sent).toEqual([['n', 2]]);
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(captured?.[0]).toMatchObject({ n: 2, onClick: next });
  });

  it('resets frame-local values back to the original args', () => {
    let captured: ReturnType<typeof useArgs> | undefined;
    const sent = mount(
      load({
        render: function Read() {
          captured = useArgs();
          return null;
        },
      }),
    );
    act(() => captured?.[1]({ onClick: () => 'next', extra: () => 'extra', n: 2 }));
    act(() => captured?.[2]());
    expect(captured?.[0]).toEqual({ n: 1, label: 'x', onClick: original });

    act(() => captured?.[1]({ onClick: 'a string' }));
    expect(captured?.[0].onClick).toBe('a string');
    sent.length = 0;
    act(() => captured?.[2](['onClick']));
    expect(sent).toEqual([]);
    expect(captured?.[0].onClick).toBe(original);
  });

  it('keeps a React element in the frame and renders it', () => {
    let captured: ReturnType<typeof useArgs> | undefined;
    const sent = mount(
      load({
        render: function Read() {
          captured = useArgs();
          return <div>{captured[0].icon as ReactNode}</div>;
        },
      }),
    );
    act(() => captured?.[1]({ icon: <b>local</b> }));
    expect(sent).toEqual([]);
    expect(screen.getByText('local').tagName).toBe('B');
  });

  it('shares frame-local values between a decorator and the story', () => {
    let fromDecorator: ReturnType<typeof useArgs> | undefined;
    let seen: Args | undefined;
    mount(
      load({
        decorators: [
          (Story: ComponentType) => {
            function Decorate() {
              fromDecorator = useArgs();
              return <Story />;
            }
            return <Decorate />;
          },
        ],
        render: (args: Args) => {
          seen = args;
          return null;
        },
      }),
    );
    const next = () => 'next';
    act(() => fromDecorator?.[1]({ onClick: next }));
    expect(seen?.onClick).toBe(next);
  });
});

describe('useArgs shim', () => {
  const load = (renderFn: (args: Record<string, unknown>) => React.ReactNode) =>
    loadCsfModule(
      {
        default: { title: 'ui/Slider', args: { thumbCount: 3, label: 'x', onInput: () => {} } },
        Playground: { args: { label: 'y' }, render: renderFn },
      },
      '/repo/Slider.stories.tsx',
      '/repo',
    )[0];

  it('reads the story args and writes each patched key through setConfig', () => {
    let captured: ReturnType<typeof useArgs> | undefined;
    const story = load(() => {
      captured = useArgs();
      return <p>{String(captured[0].thumbCount)}</p>;
    });
    if (!story) throw new Error('no story');
    const setConfig = vi.fn();
    const ctx: StoryContext = {
      config: { thumbCount: 5, label: 'y' },
      setConfig,
      state: null,
      setState: vi.fn(),
      globals: {},
      title: story.title,
      name: story.name,
    };
    function Render() {
      return story?.render(ctx);
    }
    render(<Render />);
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(captured?.[0]).toEqual({ thumbCount: 5, label: 'y', onInput: expect.any(Function) });

    act(() => captured?.[1]({ thumbCount: 4, label: 'z' }));
    expect(setConfig.mock.calls).toEqual([
      ['thumbCount', 4],
      ['label', 'z'],
    ]);

    setConfig.mockClear();
    act(() => captured?.[2](['label']));
    expect(setConfig.mock.calls).toEqual([['label', 'y']]);

    setConfig.mockClear();
    act(() => captured?.[2]());
    expect(setConfig.mock.calls).toEqual([
      ['thumbCount', 3],
      ['label', 'y'],
    ]);
  });

  it('resets keys updateArgs wrote that have no config leaf', () => {
    let captured: ReturnType<typeof useArgs> | undefined;
    const [story] = loadCsfModule(
      {
        default: { title: 'ui/Keycaps', args: { label: 'x', separator: null, onInput: () => {} } },
        A: {
          render: function ReadArgs() {
            captured = useArgs();
            return null;
          },
        },
      },
      '/repo/Keycaps.stories.tsx',
      '/repo',
    );
    if (!story) throw new Error('no story');
    expect(Object.keys(story.config.nodes)).toEqual(['label']);
    const setConfig = vi.fn();
    const ctx: StoryContext = {
      config: { label: 'changed', separator: '+', extra: 7 },
      setConfig,
      state: null,
      setState: vi.fn(),
      globals: {},
      title: story.title,
      name: story.name,
    };
    function Render() {
      return story?.render(ctx);
    }
    render(<Render />);

    act(() => captured?.[2]());
    expect(setConfig.mock.calls).toEqual([
      ['label', 'x'],
      ['separator', null],
      ['extra', undefined],
    ]);

    setConfig.mockClear();
    act(() => captured?.[2](['extra', 'onInput']));
    expect(setConfig.mock.calls).toEqual([['extra', undefined]]);
  });

  it('throws outside a CSF story', () => {
    function Stray() {
      useArgs();
      return null;
    }
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Stray />)).toThrow(/useArgs/);
    vi.restoreAllMocks();
  });
});
