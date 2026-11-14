import { isPageStructure, type SelectionApi, useActiveToolContext, type View } from '@weasel-js/core';
import { qty, zoom } from '@weasel-js/quantity';
import { Bar } from '@weasel-js/ui/components/Bar';
import { ThemeSwitcher } from '@weasel-js/ui/components/ThemeSwitcher';
import { solidColorOf } from '@weasel-js/paint';
import type { ReactElement } from 'react';
import { buildLabel, buildTitle } from '../../shared/buildInfo';
import type { ActivePaint } from './newShapePaint';
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
    if (n && n.kind === 'group' && !isPageStructure(n)) groupCount++;
  }
  const paintLabel = (p: ActivePaint): string =>
    p === null ? 'none' : solidColorOf(p) ?? p.kind ?? 'solid';
  const engaged = activeTool.hotkeyStack[activeTool.hotkeyStack.length - 1];
  const toolLabel = engaged ? `${activeTool.active} → ${engaged}` : activeTool.active;
  return (
    <Bar framed="status" label="Editor status" className="wd-statusbar">
      <ModeStatusIndicator mode={machine.registry.byId(modeId)} />
      <Bar.Readout>tool: {toolLabel}</Bar.Readout>
      <Bar.Readout>sel: {selection.current.length}</Bar.Readout>
      <Bar.Readout>groups: {groupCount}</Bar.Readout>
      <Bar.Readout>fill: {paintLabel(colors.fill)}</Bar.Readout>
      <Bar.Readout>stroke: {paintLabel(colors.stroke)}</Bar.Readout>
      <Bar.Spacer />
      <Bar.Readout>zoom: {qty(view.scale.x, zoom()).text}</Bar.Readout>
      {colorMode && (
        <Bar.Readout>
          <ThemeSwitcher value={colorMode.preference} onChange={colorMode.setPreference} />
        </Bar.Readout>
      )}
      <Bar.Readout muted title={buildTitle()}>{buildLabel()}</Bar.Readout>
    </Bar>
  );
}
