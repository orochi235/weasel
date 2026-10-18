import { type Contribution, type SelectionApi, type SurfaceContribution, useLatest, type View } from '@weasel-js/core';
import { useHudContribution } from '@weasel-js/hud/react';
import { useMemo } from 'react';
import { type AppCommands, appCommandsContribution } from './appCommands';
import type { DrawScene } from './drawDocument';
import { useRecording } from './recording/useRecording';
import { hasCompoundPath, releaseCompoundPaths } from './releaseCompound';
import { useChromeCommands } from './surfaces/surfaceState';
import { colorContribution, useColorContext } from './tools/colorContext';

export interface EditorAmbientArgs {
  scene: DrawScene;
  selection: SelectionApi;
  /** The mode shortcuts and double-click entry, from `useCanvasModes`. */
  modes: readonly Contribution[];
  grid: Pick<AppCommands, 'gridVisible' | 'toggleGrid' | 'snapToGrid' | 'toggleSnap'>;
  pathDirection: Pick<AppCommands, 'pathDirection' | 'togglePathDirection'>;
  /** Live symmetry, from `useSymmetry`: its canvas entry and its toggle. */
  symmetry: {
    contribution: SurfaceContribution;
    commands: Pick<AppCommands, 'symmetryOn' | 'toggleSymmetry'>;
  };
  view: View;
  setView: (view: View) => void;
  openPrefs: () => void;
  openPalette: () => void;
}

/** Everything draw binds on the canvas whatever tool is active: the HUD, the mode keys, the
 *  color keys, the app's own commands, the input recorder, and live symmetry. */
export function useEditorAmbient(args: EditorAmbientArgs): readonly SurfaceContribution[] {
  const { scene, selection, modes, view, setView } = args;
  const hudTool = useHudContribution();

  const colorsRef = useLatest(useColorContext());
  const colorKeys = useMemo(() => colorContribution(() => colorsRef.current), [colorsRef]);

  const chrome = useChromeCommands();
  const appCommands: AppCommands = {
    ...args.grid,
    ...args.pathDirection,
    ...args.symmetry.commands,
    ...chrome,
    canReleaseCompound: hasCompoundPath(scene, selection.current),
    releaseCompound: () => selection.set(releaseCompoundPaths(scene, selection.current)),
    openPrefs: args.openPrefs,
    openPalette: args.openPalette,
  };
  const appCommandsRef = useLatest(appCommands);
  const appKeys = useMemo(() => appCommandsContribution(() => appCommandsRef.current), [appCommandsRef]);

  const recordingKeys = useRecording({ scene, view: () => view, setView });
  const symmetry = args.symmetry.contribution;

  return useMemo(
    () => [hudTool, ...modes, colorKeys, appKeys, recordingKeys, symmetry],
    [hudTool, modes, colorKeys, appKeys, recordingKeys, symmetry],
  );
}
