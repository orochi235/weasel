import { useCommand } from '@weasel-js/core';
import type { EditorLook } from '@weasel-js/diagram/effect';
import { pref } from '@weasel-js/prefs';
import { type MenuRuns } from '@weasel-js/editor';
import { can } from '../menuBar';
import { useChartPref } from '../prefs';

export const LOOK_ACTIONS = {
  nodeGraph: 'pipeline.look.nodeGraph', rack: 'pipeline.look.rack', lanes: 'pipeline.look.lanes',
  across: 'pipeline.rack.across', down: 'pipeline.rack.down',
} as const;

/** Which way the Rack look runs its main line. */
export type RackDirection = 'right' | 'down';

/** Pipeline mode's View menu: the Look and Rack Direction submenus. */
export const LOOK_MENU: MenuRuns = {
  look: pref.group('', {
    look: pref.group('Look', {
      nodeGraph: pref.action(LOOK_ACTIONS.nodeGraph),
      rack: pref.action(LOOK_ACTIONS.rack),
      lanes: pref.action(LOOK_ACTIONS.lanes),
    }, { as: 'menu' }),
    rackDirection: pref.group('Rack Direction', {
      across: pref.action(LOOK_ACTIONS.across),
      down: pref.action(LOOK_ACTIONS.down),
    }, { as: 'menu' }),
  }),
};

/** Registers View › Look › Node graph, Rack and Lanes, each reading as held while its look is on, and View › Rack
 *  Direction › Across and Down, which apply under Rack. Answers the rack direction picked. */
export function useLookCommands(look: EditorLook, setLook: (look: EditorLook) => void): RackDirection {
  const [direction, setDirection] = useChartPref('pipeline.rackDirection');
  useCommand(LOOK_ACTIONS.nodeGraph, 'Node graph', () => setLook('nodeGraph'), { active: () => look === 'nodeGraph' });
  useCommand(LOOK_ACTIONS.rack, 'Rack', () => setLook('rack'), { active: () => look === 'rack' });
  useCommand(LOOK_ACTIONS.lanes, 'Lanes', () => setLook('lanes'), { active: () => look === 'lanes' });
  const rack = () => can(look === 'rack');
  useCommand(LOOK_ACTIONS.across, 'Across', () => setDirection('right'), { active: () => direction === 'right', enabled: rack });
  useCommand(LOOK_ACTIONS.down, 'Down', () => setDirection('down'), { active: () => direction === 'down', enabled: rack });
  return direction;
}
