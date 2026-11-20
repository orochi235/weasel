/** The Frame tab against a page the test plays, whose fps overlay the test turns on behind the tab's back. */
import { afterEach, expect, it } from 'vitest';
import { cleanup, screen, waitFor } from '@testing-library/react';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import type { DevtoolsClient } from '../client';
import { FrameView } from './FrameView';

afterEach(cleanup);

it('follows the fps overlay when the page turns it on by other means, without a notice', async () => {
  const overlays: Record<string, boolean> = { fps: false };
  const client = {
    onChanged: () => () => {},
    request: async (_root: string, m: { type: string }) => (m.type === 'get-frame'
      ? { paintMs: 1, drawCalls: 2, layers: [] }
      : { selection: [], view: {}, activeTool: null, tools: [], overlays: { ...overlays }, probes: {} }),
  } as unknown as DevtoolsClient;
  renderWithIcons(<FrameView client={client} rootId="r" />);
  expect(await screen.findByText(/measures its paints only while/)).toBeTruthy();
  overlays.fps = true;
  await waitFor(() => expect(screen.queryByText(/measures its paints only while/)).toBeNull(), { timeout: 2000 });
});
