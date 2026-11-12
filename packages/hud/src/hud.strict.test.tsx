import { describe, expect, it, vi } from 'vitest';
import { StrictMode, useEffect } from 'react';
import { render } from '@testing-library/react';
import { createHud, type Hud } from './hud';

const host = { requestRedraw: () => {}, registerLayer: vi.fn(() => () => {}), subscribeFrame: vi.fn(() => () => {}) };

function Child({ hud }: { hud: Hud }) {
  useEffect(() => {
    const w = hud.rect({ id: 'r', x: 0, y: 0, w: 1, h: 1, fill: '#000' });
    return () => hud.remove(w);
  }, [hud]);
  return null;
}

function Parent({ hud }: { hud: Hud }) {
  useEffect(() => {
    hud.bind(host as never);
    return () => hud.unbind();
  }, [hud]);
  return <Child hud={hud} />;
}

describe('a HUD under StrictMode', () => {
  it('keeps a widget a child adds in its effect, though the parent rebinds after the child re-runs', () => {
    const hud = createHud();
    render(<StrictMode><Parent hud={hud} /></StrictMode>);
    expect(hud.widgets().map((w) => w.id)).toEqual(['r']);
    expect(hud.attached).toBe(true);
  });
});
