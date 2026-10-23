import { type SelectionApi, useActiveToolContext, type View } from '@weasel-js/core';
import { qty, zoom } from '@weasel-js/quantity';
import { StatusBar, StatusBarItem, StatusBarSpacer } from '@weasel-js/ui/components/StatusBar';
import { ThemeSwitcher } from '@weasel-js/ui/components/ThemeSwitcher';
import { solidColorOf } from '@weasel-js/ui/paint-value';
import type { ReactElement } from 'react';
import { buildLabel, buildTitle } from '../../shared/buildInfo';
import type { ActivePaint } from './ActiveSwatches';
import { useColorModeControl } from './colorMode';
import type { DrawScene } from './drawDocument';
import type { ModeMachine } from './modality';
import { ModeStatusIndicator } from './modality/chrome/ModeStatusIndicator';
import { useModeId } from './modality/useModeId';
import { useColorContext } from './tools/colorContext';

export function EditorStatusBar({
  scene,
  selection,
  view,
  machine,
}: {
  scene: DrawScene;
  selection: SelectionApi;
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
    if (n && n.kind === 'group') groupCount++;
  }
  const paintLabel = (p: ActivePaint): string =>
    p === null ? 'none' : solidColorOf(p) ?? p.kind ?? 'solid';
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
