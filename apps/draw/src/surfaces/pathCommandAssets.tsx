import { useContext } from 'react';
import { pref } from '@weasel-js/prefs';
import { CORNER_CONTROLS } from '@weasel-js/path-tools';
import { CornerShape } from '../ui/CornerShape';
import { BridgeSlider, OffsetSlider, SimplifySlider } from '../ui/PathCommands';
import { appLeaf, blockLeaf, inPopover } from './appLeaves';
import { SurfaceHostContext } from './hostContext';
import type { SurfaceAsset } from './types';
import s from './pathCommandAssets.module.css';

const SIMPLIFY_KIND = 'draw.simplify';
const OFFSET_KIND = 'draw.offset';
const BRIDGE_KIND = 'draw.bridge';
const CORNERS_KIND = 'draw.corners';

/** The Simplify slider at the editor's tolerance. Outside the editor there is none to show. */
function HostSimplify({ className }: { className?: string }) {
  const host = useContext(SurfaceHostContext);
  if (!host) return null;
  return <SimplifySlider tolerance={host.simplifyTolerance} onTolerance={host.setSimplifyTolerance} {...(className ? { className } : {})} />;
}

/** The Bridge tension slider at the editor's tension. Outside the editor there is none to show. */
function HostBridge({ className }: { className?: string }) {
  const host = useContext(SurfaceHostContext);
  if (!host) return null;
  return <BridgeSlider tension={host.bridgeTension} onTension={host.setBridgeTension} {...(className ? { className } : {})} />;
}

/** Corner shape over the editor's open path. Outside the editor there is none to show. */
function HostCorners({ className }: { className?: string }) {
  const host = useContext(SurfaceHostContext);
  if (!host) return null;
  return <CornerShape scene={host.scene} selection={host.cornerSelection} {...(className ? { className } : {})} />;
}

const PATH_COMMANDS = pref.group('Simplify, Offset, and Bridge', {
  simplify: appLeaf(SIMPLIFY_KIND, 'Simplify'),
  offset: appLeaf(OFFSET_KIND, 'Offset'),
  bridge: appLeaf(BRIDGE_KIND, 'Bridge'),
});

const CORNERS = pref.group(CORNER_CONTROLS.name, { corners: blockLeaf(CORNERS_KIND, CORNER_CONTROLS.name) });

/**
 * Simplify, Offset, Bridge, and Corner shape: command-row assets of draw's own controls. A menu draws no app-defined leaf, so
 * each is a bar, where a button opens its control, or a panel, which holds the control itself.
 */
export const PATH_COMMAND_ASSETS: readonly SurfaceAsset[] = [
  {
    id: 'pathCommands', label: 'Simplify, Offset, and Bridge', schema: PATH_COMMANDS, surfaces: ['bar', 'panel'], defaultSurface: 'bar', row: 'command',
    renderers: {
      bar: {
        [SIMPLIFY_KIND]: inPopover('Simplify', HostSimplify), [OFFSET_KIND]: inPopover('Offset', OffsetSlider),
        [BRIDGE_KIND]: inPopover('Bridge', HostBridge),
      },
      panel: {
        [SIMPLIFY_KIND]: () => <HostSimplify className={s.fill} />,
        [OFFSET_KIND]: () => <OffsetSlider className={s.fill} />,
        [BRIDGE_KIND]: () => <HostBridge className={s.fill} />,
      },
    },
  },
  {
    id: 'corners', label: CORNER_CONTROLS.name, schema: CORNERS, surfaces: ['bar', 'panel'], defaultSurface: 'bar', row: 'command',
    renderers: {
      bar: { [CORNERS_KIND]: inPopover(CORNER_CONTROLS.name, () => <HostCorners className={s.cornerPopover} />) },
      panel: { [CORNERS_KIND]: () => <HostCorners /> },
    },
  },
];
