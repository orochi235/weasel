/** A stable role installs once per host, and moves when the host's API or dep registry is replaced. */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { StrictMode } from 'react';
import { DepRegistryProvider, Yoke, useOptionalDepRegistry, useYoke } from '@weasel-js/routing/react';
import { useContributionRoles } from './useContributionRoles';
import type { ToolsApi } from '../../tools/overlayBinding';
import type { CanvasExtensionApi } from '../canvasExtension';
import type { SurfaceContribution } from '../surfaceContribution';

function fakeApi(name: string): CanvasExtensionApi {
  return { name, registerLayer: vi.fn(() => vi.fn()), requestRedraw: vi.fn() } as unknown as CanvasExtensionApi;
}

function toolsOf(ambient: readonly SurfaceContribution[]): ToolsApi {
  return { registry: {}, ambient } as unknown as ToolsApi;
}

/** Records every live installation as `role@host`, so a duplicate or a leak shows in the list. */
function recorder() {
  const live: string[] = [];
  const hostOf = new WeakMap<object, string>();
  let regs = 0;
  const label = (o: object | null) => {
    if (!o) return 'none';
    if (!hostOf.has(o)) hostOf.set(o, (o as { name?: string }).name ?? `reg${++regs}`);
    return hostOf.get(o)!;
  };
  const track = (tag: string) => {
    live.push(tag);
    return vi.fn(() => { live.splice(live.indexOf(tag), 1); });
  };
  return { live, label, track };
}

function Roles({ entries, api }: { entries: readonly SurfaceContribution[]; api: CanvasExtensionApi | null }) {
  useContributionRoles(toolsOf(entries), api, 'off');
  return null;
}

describe('contribution roles rebind to their host', () => {
  it('attaches a stable attach once per API, and moves it when the API changes or goes null', () => {
    const rec = recorder();
    const attach = vi.fn((api: CanvasExtensionApi) => rec.track(`attach@${rec.label(api)}`));
    const entry = { id: 'f', attach } as unknown as SurfaceContribution;
    const a = fakeApi('A');
    const b = fakeApi('B');

    const view = render(<Roles entries={[entry]} api={null} />);
    expect(rec.live).toEqual([]);
    view.rerender(<Roles entries={[entry]} api={a} />);
    view.rerender(<Roles entries={[{ ...entry }]} api={a} />);
    expect(attach).toHaveBeenCalledTimes(1);
    expect(rec.live).toEqual(['attach@A']);

    view.rerender(<Roles entries={[entry]} api={b} />);
    expect(rec.live).toEqual(['attach@B']);
    view.rerender(<Roles entries={[entry]} api={null} />);
    expect(rec.live).toEqual([]);
    view.rerender(<Roles entries={[entry]} api={a} />);
    expect(rec.live).toEqual(['attach@A']);
    view.unmount();
    expect(rec.live).toEqual([]);
    expect(attach).toHaveBeenCalledTimes(3);
  });

  it('moves deps, watch and attach to a replacement dep registry', () => {
    const rec = recorder();
    const reads: unknown[] = [];
    const attach = vi.fn((api: CanvasExtensionApi, deps: { get(n: string): unknown }) => {
      reads.push(deps.get('probe' as never));
      return rec.track(`attach@${rec.label(api)}`);
    });
    const watch = vi.fn(() => rec.track('watch'));
    const deps = { probe: () => 1 } as never;
    const entry = { id: 'f', deps, watch, attach } as unknown as SurfaceContribution;
    const api = fakeApi('A');

    function Host({ generation }: { generation: number }) {
      return <DepRegistryProvider key={generation}><Roles entries={[entry]} api={api} /></DepRegistryProvider>;
    }
    const view = render(<Host generation={0} />);
    expect(rec.live.sort()).toEqual(['attach@A', 'watch']);
    expect(reads).toEqual([1]);
    view.rerender(<Host generation={1} />);
    expect(rec.live.sort()).toEqual(['attach@A', 'watch']);
    expect(reads).toEqual([1, 1]);
    expect(watch).toHaveBeenCalledTimes(2);
    view.unmount();
    expect(rec.live).toEqual([]);
  });

  it('moves roles when one mounted provider hands the hook a different registry', () => {
    const rec = recorder();
    const attach = vi.fn((api: CanvasExtensionApi) => rec.track(`attach@${rec.label(api)}`));
    const watch = vi.fn(() => rec.track('watch'));
    const deps = { probe: () => 1 } as never;
    const entry = { id: 'f', watch, attach, deps } as unknown as SurfaceContribution;
    const api = fakeApi('A');
    const seen = new Set<unknown>();
    function Probe() {
      seen.add(useOptionalDepRegistry());
      return null;
    }
    // The `<Yoke>` stays mounted and only its value changes, so nothing below remounts.
    function Host({ second }: { second: boolean }) {
      const one = useYoke();
      const two = useYoke();
      return <Yoke value={second ? two : one}><Probe /><Roles entries={[entry]} api={api} /></Yoke>;
    }
    const view = render(<Host second={false} />);
    expect(rec.live.sort()).toEqual(['attach@A', 'watch']);
    view.rerender(<Host second />);
    expect(seen.size).toBe(2);
    expect(rec.live.sort()).toEqual(['attach@A', 'watch']);
    expect(attach).toHaveBeenCalledTimes(2);
    expect(watch).toHaveBeenCalledTimes(2);
    expect([...seen].map((r) => (r as { get(n: string): unknown }).get('probe'))).toEqual([undefined, 1]);
    view.unmount();
    expect(rec.live).toEqual([]);
  });

  it('registers each overlay layer on the current API only', () => {
    const layer = { id: 'ov', draw: () => [] };
    const entry = { id: 'f', overlay: layer } as unknown as SurfaceContribution;
    const a = fakeApi('A');
    const b = fakeApi('B');
    function Surface({ api }: { api: CanvasExtensionApi }) {
      useContributionRoles(toolsOf([]), api, 'off', [entry]);
      return null;
    }
    const view = render(<Surface api={a} />);
    view.rerender(<Surface api={a} />);
    expect(a.registerLayer).toHaveBeenCalledTimes(1);
    const disposeA = vi.mocked(a.registerLayer).mock.results[0]!.value as ReturnType<typeof vi.fn>;
    view.rerender(<Surface api={b} />);
    expect(disposeA).toHaveBeenCalledTimes(1);
    expect(b.registerLayer).toHaveBeenCalledTimes(1);
    expect(a.registerLayer).toHaveBeenCalledTimes(1);
    const disposeB = vi.mocked(b.registerLayer).mock.results[0]!.value as ReturnType<typeof vi.fn>;
    view.unmount();
    expect(disposeB).toHaveBeenCalledTimes(1);
  });

  it('leaves one installation under StrictMode, and none after unmount', () => {
    const rec = recorder();
    const attach = vi.fn((api: CanvasExtensionApi) => rec.track(`attach@${rec.label(api)}`));
    const watch = vi.fn(() => rec.track('watch'));
    const entry = { id: 'f', attach, watch, deps: {} } as unknown as SurfaceContribution;
    const a = fakeApi('A');
    const b = fakeApi('B');
    const tree = (api: CanvasExtensionApi) => (
      <StrictMode><DepRegistryProvider><Roles entries={[entry]} api={api} /></DepRegistryProvider></StrictMode>
    );
    const view = render(tree(a));
    expect(rec.live.sort()).toEqual(['attach@A', 'watch']);
    view.rerender(tree(b));
    expect(rec.live.sort()).toEqual(['attach@B', 'watch']);
    view.unmount();
    expect(rec.live).toEqual([]);
  });
});
