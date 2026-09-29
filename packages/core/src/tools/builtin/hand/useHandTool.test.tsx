import { describe, it, expect } from 'vitest';
import { resolveParams } from '@weasel-js/routing';
import { renderThenAbandon } from '@weasel-js/routing/testing/abandonRender';
import { useHandTool } from './useHandTool';
import type { Tool } from '../../overlayBinding';

describe('useHandTool', () => {
  it('the drag params thunk reads the committed options, not an abandoned render\'s', () => {
    let tool = null as Tool<unknown> | null;
    function Probe({ axis }: { axis: 'x' | 'y' }) {
      tool = useHandTool({ axis }) as Tool<unknown>;
      return null;
    }
    renderThenAbandon<'x' | 'y'>('x', 'y', (axis) => <Probe axis={axis} />);
    expect(resolveParams(tool!.bindings![0].opts?.params)).toEqual({ axis: 'x', inertia: undefined });
  });
});
