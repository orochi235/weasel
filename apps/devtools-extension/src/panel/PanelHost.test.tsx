import { describe, it, expect } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { createInPageTransports } from '@weasel-js/core/devtools';
import type { PresenceOptions } from '../hookPresence';
import { PanelHost } from './PanelHost';

function presence() {
  const nav = new Set<() => void>();
  const state = { hook: false };
  const opts: PresenceOptions = {
    probe: async () => state.hook,
    onNavigated: (l) => { nav.add(l); return () => { nav.delete(l); }; },
    delays: [0],
  };
  return { state, opts, navigate: () => { for (const l of [...nav]) l(); } };
}

const NO_WEASEL = /No weasel on this page/;

describe('the panel page', () => {
  it('says so when the page has no weasel, and hosts the panel once it does', async () => {
    const p = presence();
    const { panel } = createInPageTransports();
    const sent: string[] = [];
    const transport = { ...panel, send: (m: Parameters<typeof panel.send>[0]) => { sent.push(m.type); } };
    render(<PanelHost presence={p.opts} transport={transport} />);
    expect(await screen.findByText(NO_WEASEL)).toBeInTheDocument();

    p.state.hook = true;
    await act(() => new Promise((r) => setTimeout(r, 10)));
    expect(screen.queryByText(NO_WEASEL)).toBeNull();
    expect(sent).toContain('yo');
  });

  it('gives each page a fresh panel, which says yo again', async () => {
    const p = presence();
    p.state.hook = true;
    const { panel } = createInPageTransports();
    const sent: string[] = [];
    const transport = { ...panel, send: (m: Parameters<typeof panel.send>[0]) => { sent.push(m.type); } };
    render(<PanelHost presence={p.opts} transport={transport} />);
    await act(() => new Promise((r) => setTimeout(r, 10)));
    sent.length = 0;
    await act(async () => { p.navigate(); await new Promise((r) => setTimeout(r, 10)); });
    expect(sent.at(-1)).toBe('yo');
  });
});
