import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { StoryContext } from '../../story/types';
import { loadCsfModule } from '../loadCsfModule';
import { useArgs } from './preview-api';

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
