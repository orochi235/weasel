import '@weasel-js/theme/tokens.css';
import { act, cleanup, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { DEBUG_FEATURES } from '@weasel-js/core';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { sweepAcross } from '@weasel-js/ui/testing/sweep';
import type { DevtoolsClient } from '../client';
import { StateView } from './StateView';

// The overlay switches wrap in the panel's width, so which switches a drag crosses only real layout answers.

afterEach(cleanup);

test('a drag across the overlay switches turns on each one it crosses, and an Alt-drag shows those alone', async () => {
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
  sweepAcross(switches.slice(0, 3));
  await act(async () => {});
  expect(DEBUG_FEATURES.filter((f) => overlays[f])).toEqual(DEBUG_FEATURES.slice(0, 3));
  sweepAcross(switches.slice(3, 5), { altKey: true });
  await act(async () => {});
  expect(DEBUG_FEATURES.filter((f) => overlays[f])).toEqual(DEBUG_FEATURES.slice(3, 5));
});
