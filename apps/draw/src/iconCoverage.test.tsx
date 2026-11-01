/**
 * Every glyph a tool or action on draw's canvas names is one draw registers: the tables
 * `virtual:weasel-icons` serves, as `main.tsx` mounts them. A name missing there draws a "?".
 */
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import icons from 'virtual:weasel-icons';
import {
  ActionsProvider, BUILTIN_TOOL_IDS, DepRegistryProvider, SceneCanvas, createScene, useActionsRegistry,
  type ActionsRegistry, type ToolsApi,
} from '@weasel-js/core';
import { usePathToolsTools } from '@weasel-js/path-tools';
import { appCommandsContribution, type AppCommands } from './appCommands';
import type { WeaselDrawData, WeaselDrawLayer, WeaselDrawPose } from './drawDocument';
import { DRAW_FEATURES } from './drawFeatures';

beforeAll(() => {
  (HTMLCanvasElement.prototype as unknown as { getContext: () => null }).getContext = () => null;
});
afterEach(() => cleanup());

const commands: AppCommands = {
  gridVisible: false, toggleGrid: vi.fn(), snapToGrid: false, toggleSnap: vi.fn(),
  symmetryOn: false, toggleSymmetry: vi.fn(), canReleaseCompound: false, releaseCompound: vi.fn(),
  openPalette: vi.fn(), chromeHidden: () => false, toggleChrome: vi.fn(),
};

it("registers every glyph a tool or action on draw's canvas names", () => {
  const scene = createScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>({ systemLayers: [{ id: 'default' }] });
  let registry: ActionsRegistry | null = null;
  let tools: ToolsApi | null = null;
  function Probe() {
    registry = useActionsRegistry();
    return null;
  }
  function Canvas() {
    const pathToolsTools = usePathToolsTools();
    return (
      <SceneCanvas<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose> features={DRAW_FEATURES}
        scene={scene} layers={{}} width={64} height={64} defaultTools={BUILTIN_TOOL_IDS} tools={pathToolsTools}
        onToolsCreated={(t) => { tools = t; }} ambient={[appCommandsContribution(() => commands)]} />
    );
  }
  render(<DepRegistryProvider><ActionsProvider><Probe /><Canvas /></ActionsProvider></DepRegistryProvider>);

  const named = new Map<string, string>();
  for (const tool of Object.values((tools as ToolsApi | null)!.registry)) {
    const ref = tool.presentation?.icon;
    if (ref) named.set(ref, `tool ${tool.id}`);
  }
  for (const action of (registry as ActionsRegistry | null)!.list()) {
    for (const ref of [action.icon, ...(action.variants ?? []).map((v) => v.icon)]) {
      if (ref) named.set(ref, `action ${action.id}`);
    }
  }
  expect(named.size).toBeGreaterThan(50);
  const registered = new Set(icons.flatMap((t) => Object.keys(t.icons).map((name) => `${t.namespace}:${name}`)));
  const missing = [...named].filter(([ref]) => !registered.has(ref)).map(([ref, by]) => `${ref} (${by})`);
  expect(missing).toEqual([]);
  expect(named.get('core:anchors')).toBe('tool anchors');
  expect(named.get('path-tools:pathDirection')).toBe('action pathEdit.show.direction');
});
