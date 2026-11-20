import { describe, it, expect, vi } from 'vitest';
import type { CanvasExtensionApi, CanvasInspection, ContributionDepReader, DebugFlags } from '@weasel-js/core';
import { canvasRoot } from './attach';
import { isPanelMessage } from './messageShape';
import { DEVTOOLS_PROTOCOL } from './protocol';

const api = { element: null, getView: () => null, subscribeView: () => () => {}, getDebug: () => null } as unknown as CanvasExtensionApi;

function withInspection() {
  const setDebugOverride = vi.fn<(flags: DebugFlags | null) => void>();
  const inspection = { setDebugOverride, subscribe: () => () => {} } as unknown as CanvasInspection;
  const deps: ContributionDepReader = { get: ((name: string) => (name === 'inspection' ? inspection : undefined)) as ContributionDepReader['get'] };
  return { root: canvasRoot(api, deps).root, setDebugOverride };
}

describe('canvasRoot', () => {
  it('lays only feature flags and the highlight over the canvas debug config', () => {
    const t = withInspection();
    t.root.source.setOverride({ overlays: { bounds: true, highlight: true, theme: true } as never, highlight: [] });
    expect(t.setDebugOverride).toHaveBeenLastCalledWith({ bounds: true });
    t.root.source.setOverride({ overlays: { fps: false }, highlight: ['a'] });
    expect(t.setDebugOverride).toHaveBeenLastCalledWith({ fps: false, highlight: ['a'] });
  });
});

describe('set-overlays', () => {
  const msg = (overlays: unknown) => ({ type: 'set-overlays', protocol: DEVTOOLS_PROTOCOL, requestId: 1, rootId: 'r', overlays });
  it('accepts debug features only', () => {
    expect(isPanelMessage(msg({ bounds: true, fps: false }))).toBe(true);
    expect(isPanelMessage(msg({ highlight: true }))).toBe(false);
    expect(isPanelMessage(msg({ theme: true }))).toBe(false);
  });
});
