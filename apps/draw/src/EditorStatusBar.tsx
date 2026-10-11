import {
  useActiveToolContext,
  useScene,
  useSelection,
  type View
} from '@weasel-js/core';
import { qty, zoom } from '@weasel-js/quantity';
import {
  StatusBar,
  StatusBarItem,
  StatusBarSpacer,
  ThemeSwitcher
} from '@weasel-js/ui';
import {
  type ReactElement,
  useEffect,
  useState
} from 'react';
import { buildLabel, buildTitle } from '../../shared/buildInfo';
import type { ActivePaint } from './ActiveSwatches';
import { useColorModeControl } from './colorMode';
import type { WeaselDrawData, WeaselDrawLayer, WeaselDrawPose } from './drawDocument';
import type { ModeMachine } from './modality';
import { ModeStatusIndicator } from './modality/chrome/ModeStatusIndicator';
import { useColorContext } from './tools/colorContext';

// ─── Right sidebar: LayerList + SelectionPanel ──────────────────────────────
// ─── Modality helpers ────────────────────────────────────────────────────────

/** Subscribe to the mode registry and return the current mode id reactively. */
export function useModeId(machine: ModeMachine): string {
  const [id, setId] = useState(machine.registry.current().id);
  useEffect(() => {
    return machine.registry.subscribe(() => setId(machine.registry.current().id));
  }, [machine]);
  return id;
}

export function EditorStatusBar({
  scene,
  selection,
  view,
  machine,
}: {
  scene: ReturnType<typeof useScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>>;
  selection: ReturnType<typeof useSelection>;
  view: View;
  machine: ModeMachine;
}): ReactElement {
  const modeId = useModeId(machine);
  const activeTool = useActiveToolContext();
  const colors = useColorContext();
  const colorMode = useColorModeControl();
  let groupCount = 0;
  for (const id of scene.renderOrder()) {
    const n = scene.get(id);
    if (n && n.kind === 'container') groupCount++;
  }
  const paintLabel = (p: ActivePaint): string =>
    p.kind === 'solid' ? p.color : p.kind;
  const engaged = activeTool.hotkeyStack[activeTool.hotkeyStack.length - 1];
  const toolLabel = engaged ? `${activeTool.active} → ${engaged}` : activeTool.active;
  return (
    <StatusBar ariaLabel="Editor status" className="wd-statusbar">
      <ModeStatusIndicator mode={machine.registry.byId(modeId)} />
      <StatusBarItem>tool: {toolLabel}</StatusBarItem>
      <StatusBarItem>sel: {selection.current.length}</StatusBarItem>
      <StatusBarItem>groups: {groupCount}</StatusBarItem>
      <StatusBarItem>fill: {paintLabel(colors.fill)}</StatusBarItem>
      <StatusBarItem>stroke: {paintLabel(colors.stroke)}</StatusBarItem>
      <StatusBarSpacer />
      <StatusBarItem>zoom: {qty(view.scale.x, zoom()).text}</StatusBarItem>
      {colorMode && (
        <StatusBarItem>
          <ThemeSwitcher value={colorMode.preference} onChange={colorMode.setPreference} />
        </StatusBarItem>
      )}
      <StatusBarItem muted title={buildTitle()}>{buildLabel()}</StatusBarItem>
    </StatusBar>
  );
}
