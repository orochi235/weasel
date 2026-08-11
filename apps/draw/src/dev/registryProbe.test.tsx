import { describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { ActionsProvider } from '@weasel-js/core';
import { RegistryProbe } from './registryProbe';

// jsdom doesn't implement getContext or pointer capture; stub minimally so
// SceneCanvas can mount and synthesize tools/actions. Done at module scope
// (not in beforeAll) so it's in place before render() during the first test.
{
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (...args: unknown[]) => unknown;
    setPointerCapture: (...args: unknown[]) => void;
    releasePointerCapture: (...args: unknown[]) => void;
  };
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    writable: true,
    value: vi.fn(() => ({
      canvas: { width: 0, height: 0 },
      clearRect: vi.fn(), fillRect: vi.fn(), strokeRect: vi.fn(),
      save: vi.fn(), restore: vi.fn(), translate: vi.fn(), setTransform: vi.fn(),
      scale: vi.fn(), setLineDash: vi.fn(), beginPath: vi.fn(), closePath: vi.fn(),
      moveTo: vi.fn(), lineTo: vi.fn(), arc: vi.fn(), stroke: vi.fn(), fill: vi.fn(),
      fillText: vi.fn(), measureText: vi.fn(() => ({ width: 10 })),
      font: '', textBaseline: '', globalAlpha: 1,
      fillStyle: '', strokeStyle: '', lineWidth: 1,
    })),
  });
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
}

describe('RegistryProbe', () => {
  it('reports tool and action entries after mount', async () => {
    const snapshots: { tools: readonly { id: string }[]; actions: readonly { id: string }[] }[] = [];
    const onSnapshot = (s: { tools: readonly { id: string }[]; actions: readonly { id: string }[] }) => {
      snapshots.push(s);
    };
    render(
      <ActionsProvider>
        <RegistryProbe onSnapshot={onSnapshot} />
      </ActionsProvider>,
    );
    await waitFor(() => {
      const last = snapshots[snapshots.length - 1];
      expect(last).toBeTruthy();
      expect(last!.tools.length).toBeGreaterThan(3);
      expect(last!.actions.length).toBeGreaterThan(3);
    });
    const last = snapshots[snapshots.length - 1]!;
    const toolIds = last.tools.map((t) => t.id);
    expect(toolIds).toContain('rect');
  });

  // Built-in tools route most gestures through `ToolDef.bindings` rather than
  // legacy phase-table channels. The probe must reflect both into
  // `ToolEntry.routes`, otherwise the inspector's per-tool route list shows
  // empty for tools like `rect` (whose drag flows through insertAction).
  it('reflects ToolDef.bindings into ToolEntry.routes', async () => {
    const snapshots: { tools: readonly { id: string; routes: readonly string[] }[] }[] = [];
    const onSnapshot = (s: {
      tools: readonly { id: string; routes: readonly string[] }[];
    }) => { snapshots.push(s); };
    render(
      <ActionsProvider>
        <RegistryProbe onSnapshot={onSnapshot} />
      </ActionsProvider>,
    );
    await waitFor(() => {
      const last = snapshots[snapshots.length - 1];
      expect(last).toBeTruthy();
      expect(last!.tools.length).toBeGreaterThan(3);
    });
    const last = snapshots[snapshots.length - 1]!;
    const rect = last.tools.find((t) => t.id === 'rect');
    expect(rect, 'rect tool should be probed').toBeTruthy();
    // rect's only routing path is `bindings: [{ spec: { kind: 'drag' }, ... }]`.
    // The `[*]` phase + bare drag formats as `[*] drag`.
    expect(rect!.routes).toContain('[*] drag');
  });

  // `useSelectTool` attaches its bindings to the Tool it returns (it spreads
  // the `defineTool` result and appends `bindings`), not to the ToolDef. The
  // probe used to read `def.bindings` only, so select's eight drag/click
  // bindings — the bulk of what the tool does — were absent from the
  // inspector entirely. Reading them off the runtime Tool is what the
  // dispatcher does; the probe must match.
  it('reflects Tool-level bindings, not just ToolDef.bindings', async () => {
    const snapshots: {
      tools: readonly {
        id: string;
        declaredRoutes: readonly { route: string; actionId?: string }[];
      }[];
    }[] = [];
    render(
      <ActionsProvider>
        <RegistryProbe onSnapshot={(s) => { snapshots.push(s); }} />
      </ActionsProvider>,
    );
    await waitFor(() => {
      expect(snapshots[snapshots.length - 1]?.tools.length).toBeGreaterThan(3);
    });
    const select = snapshots[snapshots.length - 1]!.tools.find((t) => t.id === 'select');
    expect(select, 'select tool should be probed').toBeTruthy();
    const actionIds = select!.declaredRoutes.map((d) => d.actionId).filter(Boolean);
    expect(actionIds).toEqual(
      expect.arrayContaining(['resize', 'rotate', 'clone', 'move', 'areaSelect', 'clearSelection']),
    );
    // The predicate-target drags all format to the same route string but
    // dispatch to different actions — de-duping on the string would drop all
    // but one of them.
    const predicateDrags = select!.declaredRoutes.filter((d) => d.route === '[*] drag => predicate');
    expect(predicateDrags.map((d) => d.actionId)).toEqual(['resize', 'rotate', 'move']);
  });

  // Parity: every built-in tool surfaced by the probe must carry the kit
  // barrel's hook name on its def (e.g. id 'rect' → hookName 'useRectTool').
  // Drift here means a hook was renamed without updating the def — surfaces
  // before it can land in the inspector's Hook column.
  it('every probed builtin tool carries its kit barrel hookName on the def', async () => {
    const snapshots: { tools: readonly { id: string; hookName?: string }[] }[] = [];
    const onSnapshot = (s: { tools: readonly { id: string; hookName?: string }[] }) => {
      snapshots.push(s);
    };
    render(
      <ActionsProvider>
        <RegistryProbe onSnapshot={onSnapshot} />
      </ActionsProvider>,
    );
    const expectedByToolId: Readonly<Record<string, string>> = {
      select: 'useSelectTool',
      hand: 'useHandTool',
      rotate: 'useRotateTool',
      rect: 'useRectTool',
      ellipse: 'useEllipseTool',
      line: 'useLineTool',
      polygon: 'usePolygonTool',
      star: 'useStarTool',
      pen: 'usePenTool',
      pencil: 'usePencilTool',
      lasso: 'useLassoTool',
      text: 'useTextTool',
      eyedropper: 'useEyedropperTool',
    };
    await waitFor(() => {
      const last = snapshots[snapshots.length - 1];
      expect(last).toBeTruthy();
      expect(last!.tools.length).toBeGreaterThan(3);
    });
    const last = snapshots[snapshots.length - 1]!;
    for (const t of last.tools) {
      const expected = expectedByToolId[t.id];
      if (!expected) continue; // consumer-authored / unknown tools tolerated
      expect(t.hookName, `tool id '${t.id}' missing hookName on its def`).toBe(expected);
    }
  });
});
