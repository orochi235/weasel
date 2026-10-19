import { createScene, SceneCanvas } from '@weasel-js/core';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import { useState } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { defineInstrument } from '../instrument/defineInstrument';
import { Lab } from '../lab/Lab';

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => null,
  ) as unknown as HTMLCanvasElement['getContext'];
});

function Board() {
  const [scene] = useState(() => createScene({ systemLayers: [{ id: 'main' }], initial: [] }));
  return <SceneCanvas scene={scene} width={50} height={50} />;
}

const instrument = defineInstrument<null, Record<string, never>>({
  name: 'Plain board',
  defaultConfig: () => ({}),
  initialState: () => null,
  render: () => <Board />,
});

describe('a trial and devtools', () => {
  it("lists a plain canvas in a trial by the trial's title, not by the pane it sits in", async () => {
    await renderSettled(<Lab instruments={[instrument]} defaultInstrument="Plain board" />, {
      wrapper: withIcons,
    });
    const labels = window.__weaselDevtools__?.roots().map((r) => r.label);
    expect(labels).toContain('Plain board');
    expect(labels).not.toContain('Content');
  });
});
