import '@weasel-js/theme/tokens.css';
import { act, cleanup, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { DEBUG_FEATURES } from '@weasel-js/core';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import type { DevtoolsClient } from '../client';
import { StateView } from './StateView';

// The overlay switches wrap in the panel's width, so which switches a drag crosses only real layout answers.

afterEach(cleanup);

test('a drag across the overlay switches turns on each one it crosses', async () => {
  const overlays: Record<string, boolean> = Object.fromEntries(DEBUG_FEATURES.map((f) => [f, false]));
  const client = {
    onChanged: () => () => {},
    request: async (_root: string, m: { type: string; overlays?: Record<string, boolean> }) => {
      if (m.type === 'set-overlays') Object.assign(overlays, m.overlays);
      return m.type === 'set-overlays' ? null : { selection: [], view: {}, activeTool: null, tools: [], overlays: { ...overlays }, probes: {} };
    },
  } as unknown as DevtoolsClient;
  renderWithIcons(<div style={{ width: 600 }}><StateView client={client} rootId="r" /></div>);
  const switches = await screen.findAllByRole('switch');
  const at = (i: number) => {
    const r = switches[i]!.closest('[data-sweep-index]')!.getBoundingClientRect();
    return { x: r.left + 8, y: r.top + r.height / 2 };
  };
  const fire = (type: string, p: { x: number; y: number }): void => {
    act(() => {
      document.elementFromPoint(p.x, p.y)!.dispatchEvent(new PointerEvent(type, {
        bubbles: true, pointerId: 1, pointerType: 'mouse', button: 0, buttons: 1, clientX: p.x, clientY: p.y,
      }));
    });
  };
  fire('pointerdown', at(0));
  fire('pointermove', at(1));
  fire('pointermove', at(2));
  fire('pointerup', at(2));
  await act(async () => {});
  expect(DEBUG_FEATURES.filter((f) => overlays[f])).toEqual(DEBUG_FEATURES.slice(0, 3));
});
