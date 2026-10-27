import { describe, it, expect } from 'vitest';
import { act } from '@testing-library/react';
import { usePenTool } from './usePenTool';
import { renderThenAbandon } from '@weasel-js/react/testing/abandonRender';
import type { Tool } from '../../overlayBinding';
import type { ActionDeps } from '@weasel-js/routing';
import { makeAdapter, penDeps } from './testing/penHarness';

describe('usePenTool — abandoned renders', () => {
  it('commits through the committed options, not an abandoned render\'s', () => {
    const adapter = makeAdapter();
    let tool = null as Tool | null;
    function Probe({ autoSelect }: { autoSelect: boolean }) {
      tool = usePenTool({ autoSelect });
      return null;
    }
    renderThenAbandon(true, false, (autoSelect) => <Probe autoSelect={autoSelect} />);
    const deps = penDeps(adapter) as unknown as ActionDeps;
    const run = (id: string, params?: Record<string, unknown>) => {
      const invoker = tool!.actions!.find((a) => a.id === id)!.invoker;
      if (invoker?.timing !== 'immediate') throw new Error(`${id} is not immediate`);
      act(() => { invoker.run(deps, params); });
    };
    run('pen.placeAnchor', { press: { x: 0, y: 0 } });
    run('pen.placeAnchor', { press: { x: 50, y: 0 } });
    run('pen.finish');
    expect(adapter.addNode).toHaveBeenCalledTimes(1);
    expect(adapter.setSelection).toHaveBeenCalledWith([adapter.ids[0]]);
  });
});
