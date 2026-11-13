/**
 * Every key and gesture WeaselDraw binds, mounted on one canvas the way the
 * workspace mounts them, with no two actions on one input in one scope. The
 * canvas runs the kit's dev route-conflict check on mount; a conflict it warns
 * about fails here.
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import {
  BUILTIN_TOOLS, PATHFINDER_KEYMAP, type Contribution, SceneCanvas, createMeasurements, createScene, measurementsContribution, modeTriggers,
  useCommand, useEyedropperTool, useMeasureTool,
} from '@weasel-js/core';
import { DEFAULT_MODES } from '@weasel-js/modes';
import { useHudContribution } from '@weasel-js/hud/react';
import { usePathToolsTools } from '@weasel-js/path-tools';
import { EDITOR_ACTIONS, EDITOR_PREFERENCES_KEY, useNewCommand, useOpenCommand, useSaveCommand } from '@weasel-js/editor';
import { createSpacingHintsPreset } from '@weasel-js/guides';
import type { DocPages } from '@weasel-js/editor';
import { useMemo } from 'react';
import { appCommandsContribution, type AppCommands } from './appCommands';
import { colorContribution } from './tools/colorContext';
import type { ColorContextValue } from './tools/colorContext/ColorContextProvider';
import { recordingContribution } from './recording/contribution';
import type { RecordingSession } from './recording/session';
import { DRAW_TUNE } from './constraintKeys';
import { DRAW_FEATURES } from './drawFeatures';
import { FILE_ACTIONS } from './fileCommands';
import { createModeMachine } from './modality/machine';
import { modePathEdit } from './modality/pathEditHost';
import { modalityShortcuts } from './modality/shortcuts';
import { useOpacityScrub } from './opacityScrub/useOpacityScrub';
import { usePageCommands } from './pages/pageCommands';

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (...args: unknown[]) => unknown;
    setPointerCapture: (...args: unknown[]) => void;
    releasePointerCapture: (...args: unknown[]) => void;
  };
  proto.getContext = vi.fn(() => null);
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const noop = (): void => {};
const history = {
  beginJournal: () => ({ applyBatch: noop, commit: noop, cancel: noop, suspend: noop }),
  resumeJournal: noop,
  entries: () => ({ undo: [], redo: [] }),
};

/** The commands draw registers through `useCommand` beside the canvas: the file and page commands and Preferences. */
function Commands() {
  useNewCommand(FILE_ACTIONS.new, 'New', noop);
  useOpenCommand(FILE_ACTIONS.open, 'Open', noop);
  useSaveCommand(FILE_ACTIONS.save, 'Save', noop);
  const pages = useMemo(() => ({ step: noop, add: noop, remove: noop, removable: () => true, shown: null }) as unknown as DocPages, []);
  usePageCommands(pages, noop);
  // `<EditorShell>`'s Preferences, which it registers with this key.
  useCommand(EDITOR_ACTIONS.preferences, 'Preferences', noop, { keys: EDITOR_PREFERENCES_KEY });
  return null;
}

function Draw({ planted = [] }: { planted?: readonly Contribution[] }) {
  const scene = useMemo(() => createScene({ systemLayers: [{ id: 'main' }] }), []);
  const machine = useMemo(() => createModeMachine({ modes: DEFAULT_MODES, history: history as never }), []);
  const measurements = useMemo(() => createMeasurements({ layer: 'notes' }), []);
  const hud = useHudContribution();
  const pathToolsTools = usePathToolsTools();
  const measureTool = useMeasureTool({ measurements });
  const eyedropperTool = useEyedropperTool({ onPick: noop });
  const { tool: opacityScrubTool } = useOpacityScrub({ scene: scene as never, selection: { get: () => [] } as never });
  const ambient = useMemo(() => [
    hud,
    modalityShortcuts(machine, { pathToEdit: () => null, selection: () => [] }),
    modeTriggers(machine.registry, { enter: noop }),
    colorContribution(() => ({}) as ColorContextValue),
    appCommandsContribution(() => ({}) as AppCommands),
    ...PATHFINDER_KEYMAP,
    recordingContribution({ attach: () => noop } as unknown as RecordingSession),
    measurementsContribution(scene as never, measurements),
    ...planted,
  ], [hud, machine, scene, measurements, planted]);
  const pathEdit = useMemo(() => modePathEdit(machine, () => true), [machine]);
  return (
    <SceneCanvas features={[...DRAW_FEATURES, createSpacingHintsPreset()]} scene={scene as never} layers={{}}
      width={64} height={64} ambient={ambient} modes={machine.registry} pathEdit={pathEdit}
      defaultTools={[BUILTIN_TOOLS]} tune={DRAW_TUNE} viewport={{ pinchZoom: true }}
      tools={{ ...pathToolsTools, measure: measureTool, opacityScrub: opacityScrubTool, eyedropper: eyedropperTool }}>
      <Commands />
    </SceneCanvas>
  );
}

function conflictsOf(planted?: readonly Contribution[]): string[] {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  render(<Draw {...(planted ? { planted } : {})} />);
  return warn.mock.calls.map((args) => String(args[0])).filter((m) => m.includes('route conflict'));
}

const PLANTED: readonly Contribution[] = [{
  id: 'planted',
  eligibility: { always: true },
  actions: [{ id: 'planted.x', label: 'Planted', invoker: { timing: 'immediate', run: noop } }],
  bindings: [{ spec: { kind: 'key', key: 'x' }, actionId: 'planted.x', opts: { id: 'planted.x.key' } }],
}];

describe("WeaselDraw's bindings", () => {
  it('reports a planted collision with the color keys', () => {
    expect(conflictsOf(PLANTED)).toEqual([expect.stringContaining('color.swap')]);
  });

  it('put no two actions on one input in one scope', () => {
    expect(conflictsOf()).toEqual([]);
  });
});
