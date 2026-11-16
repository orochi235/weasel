import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { SceneCanvas, drawPreset, useScene, type ToolsApi } from '@weasel-js/core';
import { textToolsPreset } from './presets';

type P = { x: number; y: number; width: number; height: number };

beforeAll(() => {
  (HTMLCanvasElement.prototype as unknown as { getContext: () => null }).getContext = () => null;
});
afterEach(() => cleanup());

describe('the text tools on a canvas', () => {
  it('take T for text and S for the sticky note', () => {
    const api: { tools?: ToolsApi } = {};
    function Harness() {
      const scene = useScene<Record<string, unknown>, 'main', P>({ systemLayers: [{ id: 'main' }], initial: [] });
      return (
        <SceneCanvas features={[drawPreset, textToolsPreset]} scene={scene} layers={{}} width={64} height={64}
          onToolsCreated={(t) => { api.tools = t; }} />
      );
    }
    render(<Harness />);
    for (const [key, id] of [['T', 'text'], ['S', 'sticky']] as const) {
      act(() => api.tools!.setActive('select'));
      act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })); });
      expect(api.tools!.active, key).toBe(id);
    }
  });
});
