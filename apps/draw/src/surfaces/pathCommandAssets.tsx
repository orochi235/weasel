import { useContext } from 'react';
import { pref } from '@weasel-js/prefs';
import { FILLET_CONTROLS } from '@weasel-js/path-tools';
import { Fillet } from '../ui/Fillet';
import { OffsetSlider, SimplifySlider } from '../ui/PathCommands';
import { appLeaf, blockLeaf, inPopover } from './appLeaves';
import { SurfaceHostContext } from './hostContext';
import type { SurfaceAsset } from './types';
import s from './pathCommandAssets.module.css';

const SIMPLIFY_KIND = 'draw.simplify';
const OFFSET_KIND = 'draw.offset';
const FILLETS_KIND = 'draw.fillets';

/** The Simplify slider at the editor's tolerance. Outside the editor there is none to show. */
function HostSimplify({ className }: { className?: string }) {
  const host = useContext(SurfaceHostContext);
  if (!host) return null;
  return <SimplifySlider tolerance={host.simplifyTolerance} onTolerance={host.setSimplifyTolerance} {...(className ? { className } : {})} />;
}

/** Fillet over the editor's open path. Outside the editor there is none to show. */
function HostFillets({ className }: { className?: string }) {
  const host = useContext(SurfaceHostContext);
  if (!host) return null;
  return <Fillet scene={host.scene} selection={host.filletSelection} {...(className ? { className } : {})} />;
}

const PATH_COMMANDS = pref.group('Simplify and Offset', {
  simplify: appLeaf(SIMPLIFY_KIND, 'Simplify'),
  offset: appLeaf(OFFSET_KIND, 'Offset'),
});

const FILLETS = pref.group(FILLET_CONTROLS.name, { fillets: blockLeaf(FILLETS_KIND, FILLET_CONTROLS.name) });

/**
 * Simplify, Offset, and Fillet: command-row assets of draw's own controls. A menu draws no app-defined leaf, so
 * each is a bar, where a button opens its control, or a panel, which holds the control itself.
 */
export const PATH_COMMAND_ASSETS: readonly SurfaceAsset[] = [
  {
    id: 'pathCommands', label: 'Simplify and Offset', schema: PATH_COMMANDS, surfaces: ['bar', 'panel'], defaultSurface: 'bar', row: 'command',
    renderers: {
      bar: { [SIMPLIFY_KIND]: inPopover('Simplify', HostSimplify), [OFFSET_KIND]: inPopover('Offset', OffsetSlider) },
      panel: {
        [SIMPLIFY_KIND]: () => <HostSimplify className={s.fill} />,
        [OFFSET_KIND]: () => <OffsetSlider className={s.fill} />,
      },
    },
  },
  {
    id: 'fillets', label: FILLET_CONTROLS.name, schema: FILLETS, surfaces: ['bar', 'panel'], defaultSurface: 'bar', row: 'command',
    renderers: {
      bar: { [FILLETS_KIND]: inPopover(FILLET_CONTROLS.name, () => <HostFillets className={s.filletPopover} />) },
      panel: { [FILLETS_KIND]: () => <HostFillets /> },
    },
  },
];
