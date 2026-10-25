import type { TokenHook } from '../hooks.ts';

/** Override hooks for property panels, prefs, params labels, dialogs, and timelines. */
export const PANEL_HOOKS: readonly TokenHook[] = [
  {
    name: 'detail-figure-min-width',
    type: 'dimension',
    value: '8ch',
    description: 'Least width of a value cell in a `values="figures"` DetailList.',
  },
  {
    name: 'params-label-align',
    type: 'string',
    value: 'start',
    description: 'Text alignment of row labels in PropertyPanel, Prefs and labkit’s ControlPanel.',
  },
  {
    name: 'params-label-case',
    type: 'string',
    value: 'uppercase',
    description: 'text-transform of every label and title in PropertyPanel, Prefs and labkit’s ControlPanel.',
  },
  {
    name: 'params-label-tracking',
    type: 'dimension',
    value: 'var(--wzl-tracking-wide)',
    description:
      'Letter spacing of every label and title in PropertyPanel, Prefs and labkit’s ControlPanel. Unset, rows take --wzl-tracking-wide and titles --wzl-tracking-wider.',
  },
  {
    name: 'params-label-width',
    type: 'dimension',
    value: 'auto',
    description: 'Inline size of row labels in PropertyPanel, Prefs and labkit’s ControlPanel.',
  },
  {
    name: 'params-text-size',
    type: 'dimension',
    value: 'var(--wzl-font-size-sm)',
    description:
      'Font size of a row’s label and of its value, one size for both, in PropertyPanel, Prefs, SelectionPanel and labkit’s ControlPanel.',
  },
  {
    name: 'prefs-rail-width',
    type: 'dimension',
    value: '216px',
    description: 'Width of the Prefs navigation rail.',
  },
  {
    name: 'prefs-column-width',
    type: 'dimension',
    value: '300px',
    description: 'Width of the Prefs category column.',
  },
  {
    name: 'prop-columns',
    type: 'string',
    value: '1fr 1fr',
    description:
      'Column tracks of a Properties list, group body, and subpanel. A container too narrow for two columns sets `minmax(0, 1fr)` to stack every row.',
  },
  {
    name: 'prop-number-width',
    type: 'dimension',
    value: '9ch',
    description: 'Width of a numeric field in the Properties panel.',
  },
  {
    name: 'prop-row-h',
    type: 'dimension',
    value: '20px',
    description:
      'Floor under every Properties row, whatever control it holds. Unset, it is the panel’s own field height, so it follows density — 20px at the default one.',
  },
  {
    name: 'prop-text-width',
    type: 'dimension',
    value: '16ch',
    description: 'Width of a text field in the Properties panel.',
  },
  {
    name: 'property-readout-w',
    type: 'dimension',
    value: 'calc(4.5ch + 2px)',
    description: 'Width of a Properties row’s value readout — four digits, so the controls beside a column of readouts end on one line. A range whose widest value needs more widens its own readout.',
  },
  {
    name: 'timeline-label-w',
    type: 'dimension',
    value: '120px',
    description: 'Width of the Timeline’s track-label gutter.',
  },
  {
    name: 'timeline-value-axis-w',
    type: 'dimension',
    value: '32px',
    description: 'Width reserved for the Timeline’s value axis.',
  },
  {
    name: 'dialog-max-width',
    type: 'dimension',
    value: '900px',
    description: 'Widest a Dialog grows, modal or inline, before its contents wrap or scroll.',
  },
  {
    name: 'prefs-across-gap',
    type: 'dimension',
    value: '28px',
    description: 'Gap between the two columns of rows a PrefsForm pane sets side by side.',
  },
  {
    name: 'prefs-control-min',
    type: 'dimension',
    value: '80px',
    description: 'Narrowest a PrefsForm row’s control gets in a two-across pane before the row wraps it under its label.',
  },
  {
    name: 'prop-panel-actions-basis',
    type: 'dimension',
    value: 'auto',
    description: 'Width a PropertyPanel’s title row gives its actions. Set, it holds that width whatever the actions are.',
  },
  {
    name: 'prop-panel-actions-align',
    type: 'string',
    value: 'center',
    description: 'How a PropertyPanel’s title row lines its actions up with the title: center, or baseline for actions that are text.',
  },
];
