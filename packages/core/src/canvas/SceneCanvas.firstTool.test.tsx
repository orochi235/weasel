import { describe, it, expect, beforeAll, vi } from 'vitest';
import { useEffect } from 'react';
import { render } from '@testing-library/react';
import { SceneCanvas } from './SceneCanvas';
import { createScene } from 'core/scene/scene';
import { useAction, useOngoingAction } from '@weasel-js/routing/react';
import type { Action } from '@weasel-js/routing';
import { makeGLRecorder } from '@weasel-js/renderer/testing/glRecorder';

beforeAll(() => {
  const recorder = makeGLRecorder();
  const proto = HTMLCanvasElement.prototype as unknown as { getContext: (...args: unknown[]) => unknown };
  proto.getContext = vi.fn((kind: unknown) => (kind === 'webgl2' ? recorder.gl : null));
});

const ends: Array<'commit' | 'cancel'> = [];
const starts: unknown[] = [];
const paint: Action = {
  id: 'test.paint',
  label: 'Paint',
  invoker: {
    timing: 'ongoing',
    start: (ctx) => {
      starts.push(ctx.params);
      return { onEnd: (_c, reason) => { ends.push(reason); } };
    },
  },
};

/** Opens an edit on the first effect pass that reaches a dispatcher, the way a
 *  panel control seeding its value on mount does. */
function OpensOnMount() {
  useAction(paint);
  const edit = useOngoingAction(paint.id);
  useEffect(() => {
    if (starts.length === 0) edit.input({ color: '#f00' });
  });
  return null;
}

describe('<SceneCanvas> first tool', () => {
  it('does not cancel an edit opened while the canvas seeds its first tool', () => {
    const scene = createScene<{ label: string }, 'main'>({ systemLayers: [{ id: 'main' }] });
    render(
      <SceneCanvas features={['draw']} width={100} height={100} scene={scene} layers={{}}>
        <OpensOnMount />
      </SceneCanvas>,
    );
    expect(starts).toEqual([{ color: '#f00' }]);
    expect(ends).toEqual([]);
  });
});
