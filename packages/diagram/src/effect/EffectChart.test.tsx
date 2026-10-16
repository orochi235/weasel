import { cleanup } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

interface SeenProps {
  background?: unknown;
  onSelect?: (id: string | null) => void;
  portOptions?: { showsPort?: (port: { type?: string }) => boolean };
}
const seen: SeenProps[] = [];
const view = { mounts: 0 };
vi.mock('../DiagramView', async () => {
  const { useEffect } = await import('react');
  return {
    DiagramView: (props: SeenProps) => {
      seen.push(props);
      useEffect(() => {
        view.mounts++;
      }, []);
      return null;
    },
  };
});

import type { EffectProblem } from './check';
import { EffectChart } from './EffectChart';
import { rack } from './rack';
import type { EffectPipeline } from './types';

afterEach(() => {
  cleanup();
  seen.length = 0;
  view.mounts = 0;
});

describe('EffectChart picking', () => {
  const pipeline = { stages: [{ id: 'blur', title: 'Blur' }], wires: [], groups: [{ id: 'g', members: ['blur'] }] };

  it('reports a picked stage by its id, and anything else as none', () => {
    const onSelect = vi.fn();
    render(<EffectChart pipeline={pipeline} width={100} height={100} onSelect={onSelect} />);
    const view = seen[seen.length - 1]!;
    view.onSelect!('blur');
    view.onSelect!('g');
    view.onSelect!(null);
    expect(onSelect.mock.calls.map((c) => c[0])).toEqual(['blur', null, null]);
  });
});

describe('EffectChart background', () => {
  const pipeline = { stages: [{ id: 'a', title: 'A' }], wires: [] };

  it('hands its background to the view, and none when unset', () => {
    const ground = { color: '#0e151b' };
    render(<EffectChart pipeline={pipeline} width={100} height={100} background={ground} />);
    expect(seen[seen.length - 1]!.background).toBe(ground);
    seen.length = 0;
    render(<EffectChart pipeline={pipeline} width={100} height={100} />);
    expect('background' in seen[seen.length - 1]!).toBe(false);
  });
});

describe('EffectChart ports', () => {
  it('shows the ports a look declares and not the compass defaults', () => {
    render(<EffectChart pipeline={{ stages: [{ id: 'a', title: 'A' }], wires: [] }} width={100} height={100} />);
    const showsPort = seen[seen.length - 1]!.portOptions!.showsPort!;
    expect(showsPort({ type: 'image' })).toBe(true);
    expect(showsPort({})).toBe(false);
  });
});

describe('EffectChart problems', () => {
  const ok: EffectPipeline = { stages: [{ id: 'a', title: 'A' }], wires: [] };
  const bad: EffectPipeline = {
    stages: [{ id: 'a', title: 'A', inputs: [{ id: 'in', type: 't' }] }],
    wires: [{ from: { stage: 'ghost', port: 'out' }, to: { stage: 'a', port: 'in' } }],
  };

  it('calls onProblems when the pipeline changes, not when only the callback does', () => {
    const first = vi.fn();
    const second = vi.fn();
    const third = vi.fn();
    const { rerender } = render(<EffectChart pipeline={ok} width={100} height={100} onProblems={first} />);
    expect(first).toHaveBeenCalledTimes(1);
    rerender(<EffectChart pipeline={ok} width={100} height={100} onProblems={second} />);
    expect(second).not.toHaveBeenCalled();
    rerender(<EffectChart pipeline={bad} width={100} height={100} onProblems={third} />);
    expect(third).toHaveBeenCalledTimes(1);
    expect(third.mock.lastCall![0].map((p: { kind: string }) => p.kind)).toEqual(['missing-stage']);
  });

  it('never calls what onProblems returns', () => {
    const cleanup = vi.fn();
    const onProblems = () => cleanup;
    const { rerender, unmount } = render(<EffectChart pipeline={ok} width={100} height={100} onProblems={onProblems} />);
    rerender(<EffectChart pipeline={bad} width={100} height={100} onProblems={onProblems} />);
    unmount();
    expect(cleanup).not.toHaveBeenCalled();
  });
});

describe('EffectChart and a pipeline rebuilt each render', () => {
  const make = (title = 'A'): EffectPipeline => ({
    stages: [{ id: 'a', title, inputs: [{ id: 'in', type: 't' }] }],
    wires: [{ from: { stage: 'ghost', port: 'out' }, to: { stage: 'a', port: 'in' } }],
  });

  it('keeps the view and stays quiet for a new pipeline object that says the same', () => {
    const onProblems = vi.fn();
    const { rerender } = render(<EffectChart pipeline={make()} width={100} height={100} selected={null} onProblems={onProblems} />);
    rerender(<EffectChart pipeline={make()} width={100} height={100} selected="a" onProblems={onProblems} />);
    expect(view.mounts).toBe(1);
    expect(onProblems).toHaveBeenCalledTimes(1);
  });

  it('opens afresh, once, for a pipeline that says something else', () => {
    const onProblems = vi.fn();
    const { rerender } = render(<EffectChart pipeline={make()} width={100} height={100} onProblems={onProblems} />);
    rerender(<EffectChart pipeline={make('B')} width={100} height={100} onProblems={onProblems} />);
    expect(view.mounts).toBe(2);
    expect(onProblems).toHaveBeenCalledTimes(2);
  });

  it('opens afresh for another look, and not for another selection', () => {
    const pipeline = make();
    const { rerender } = render(<EffectChart pipeline={pipeline} width={100} height={100} selected={null} />);
    rerender(<EffectChart pipeline={pipeline} width={100} height={100} selected="a" />);
    expect(view.mounts).toBe(1);
    rerender(<EffectChart pipeline={pipeline} look={rack} width={100} height={100} selected="a" />);
    expect(view.mounts).toBe(2);
  });

  it('keeps the view through a new run, and hands it the run painted on', () => {
    const pipeline = make();
    const { rerender } = render(<EffectChart pipeline={pipeline} width={100} height={100} />);
    rerender(<EffectChart pipeline={pipeline} run={{ stages: { a: { cost: 3 } } }} width={100} height={100} />);
    rerender(<EffectChart pipeline={pipeline} run={{ stages: { a: { cost: 4 } } }} width={100} height={100} />);
    expect(view.mounts).toBe(1);
    const specs = (seen[seen.length - 1] as { specs: { id: string; data: { text?: string } }[] }).specs;
    expect(specs.find((s) => s.id === 'a/cost')?.data.text).toBe('4 ms');
  });

  it('settles under a parent that builds the pipeline inline and keeps the problems in state', () => {
    let renders = 0;
    function Parent() {
      const [problems, setProblems] = useState<readonly EffectProblem[]>([]);
      renders++;
      return (
        <EffectChart
          pipeline={make()}
          width={100}
          height={100}
          // Capped, so a loop ends the test instead of hanging it.
          onProblems={(found) => { if (renders < 20) setProblems(found); }}
          className={`n${problems.length}`}
        />
      );
    }
    render(<Parent />);
    expect(renders).toBeLessThan(5);
  });
});
