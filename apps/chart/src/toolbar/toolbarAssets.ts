// Chart mode's toolbar assets: each a prefs schema the kit's `Bar` draws, of registered actions and the few
// value leaves `useToolbarBinding` binds.

import { DEFAULT_MAX_ZOOM, DEFAULT_MIN_ZOOM } from '@weasel-js/core';
import { SET_HOPS_ACTION_ID, SET_ROUTER_ACTION_IDS } from '@weasel-js/diagram';
import { pref, type PrefGroup } from '@weasel-js/prefs';
import { CHART_ACTIONS } from '../chartCommands';
import { icon } from '../icons.gen';
import { CHART_PREFS } from '../prefs';

/** One asset: a schema with a label naming its bar to assistive tech. */
export interface ToolbarAsset {
  id: string;
  label: string;
  schema: PrefGroup;
}

/** The value leaves' paths, by asset, as `Bar` reports them. */
export const ZOOM_PATH = 'zoom';
export const SPACING_PATH = 'spacing';

const { control: _slider, ...spacing } = CHART_PREFS.children.view.children.gridSpacing;

const asset = (id: string, label: string, children: PrefGroup['children']): ToolbarAsset => ({
  id, label, schema: pref.group(label, children),
});

/** The toolbar's assets, left to right after the tool palette. */
export const TOOLBAR_ASSETS: readonly ToolbarAsset[] = [
  asset('history', 'History', { actions: pref.actions('history') }),
  asset('zoom', 'Zoom', {
    out: pref.action('viewport.zoom:out', { icon: icon('ui:zoomOut') }),
    [ZOOM_PATH]: pref.number('Zoom', 1, {
      min: DEFAULT_MIN_ZOOM, max: DEFAULT_MAX_ZOOM, unit: { suffix: '%', scale: 0.01, precision: 0 },
    }),
    in: pref.action('viewport.zoom:in', { icon: icon('ui:zoomIn') }),
    fit: pref.action('viewport.zoom:reset', { name: 'Fit page', icon: icon('ui:fit') }),
  }),
  asset('snap', 'Grid and snapping', {
    grid: pref.action(CHART_ACTIONS.grid),
    snapToGrid: pref.action(CHART_ACTIONS.snapToGrid),
    [SPACING_PATH]: { ...spacing, name: 'Spacing' },
    snapToShapes: pref.action(CHART_ACTIONS.snapToShapes),
    snapToGaps: pref.action(CHART_ACTIONS.snapToGaps),
  }),
  asset('connector', 'Connector', {
    straight: pref.action(SET_ROUTER_ACTION_IDS.straight),
    orthogonal: pref.action(SET_ROUTER_ACTION_IDS.orthogonal),
    bezier: pref.action(SET_ROUTER_ACTION_IDS.bezier),
    avoid: pref.action(SET_ROUTER_ACTION_IDS.avoid),
    hops: pref.action(SET_HOPS_ACTION_ID),
  }),
  asset('arrange', 'Arrange', {
    autoLayout: pref.action(CHART_ACTIONS.autoLayout),
  }),
];
