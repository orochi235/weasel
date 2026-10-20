import type { NodeStyle } from '../fromData';
import type { DiagramTheme } from './types';

const SANS = { family: 'sans-serif', size: 12 };

const INK = '#1f2933';
const paper: DiagramTheme = {
  id: 'paper',
  name: 'Paper',
  roles: {
    default: { fill: '#ffffff', stroke: '#3e4c59', text: INK },
    accent: { fill: '#e6f0ff', stroke: '#2f6fd6', text: INK },
    muted: { fill: '#f3f5f7', stroke: '#9aa5b1', text: '#616e7c' },
    positive: { fill: '#e8f6ec', stroke: '#2f9e57', text: INK },
    warning: { fill: '#fdf4dc', stroke: '#c98a0b', text: INK },
    negative: { fill: '#fdecec', stroke: '#d14343', text: INK },
  },
  defaultRole: 'default',
  edge: { stroke: '#3e4c59', width: 2, markerEnd: 'arrow' },
  label: { fill: INK },
  container: { fill: 'rgba(62, 76, 89, 0.04)', stroke: '#7b8794', text: '#52606d', strokeWidth: 1, dash: [4, 3] },
  lane: {
    header: { fill: '#e4e7eb', stroke: '#9aa5b1', text: INK, strokeWidth: 1 },
    bodies: [
      { fill: '#ffffff', stroke: '#cbd2d9', text: INK, strokeWidth: 1 },
      { fill: '#f5f7fa', stroke: '#cbd2d9', text: INK, strokeWidth: 1 },
    ],
  },
  page: '#ffffff',
  font: SANS,
  series: ['#2f6fd6', '#8b5cf6', '#c98a0b', '#2f9e57', '#e8590c', '#0f9b8e', '#d6336c', '#7b8794'],
};

// The effect looks' and `lanes`' own dark colors, so a look drawn under it is unchanged.
const NIGHT_TEXT = '#dbe7f2';
const night: DiagramTheme = {
  id: 'night',
  name: 'Night',
  roles: {
    default: { fill: '#16222c', stroke: '#3d566b', text: NIGHT_TEXT, strokeWidth: 1.5 },
    accent: { fill: '#13263a', stroke: '#6fb3ff', text: NIGHT_TEXT, strokeWidth: 1.5 },
    muted: { fill: '#121a21', stroke: '#3d566b', text: '#6d8496', strokeWidth: 1.5 },
    positive: { fill: '#14261c', stroke: '#5ad07f', text: NIGHT_TEXT, strokeWidth: 1.5 },
    warning: { fill: '#2a2414', stroke: '#f2c14e', text: NIGHT_TEXT, strokeWidth: 1.5 },
    negative: { fill: '#2c1618', stroke: '#ff5d5d', text: NIGHT_TEXT, strokeWidth: 1.5 },
  },
  defaultRole: 'default',
  edge: { stroke: '#7ba7c7', width: 2, markerEnd: 'arrow' },
  label: { fill: NIGHT_TEXT },
  container: { fill: 'rgba(123, 167, 199, 0.08)', stroke: '#7ba7c7', text: '#9fbdd6', strokeWidth: 1, dash: [4, 3] },
  lane: {
    header: { fill: 'rgba(255, 255, 255, 0.06)', stroke: 'rgba(255, 255, 255, 0.06)', text: '#9fbdd6', strokeWidth: 1 },
    bodies: [
      { fill: 'rgba(255, 255, 255, 0.035)', stroke: 'rgba(255, 255, 255, 0.06)', text: '#9fbdd6', strokeWidth: 1 },
      { fill: 'rgba(255, 255, 255, 0)', stroke: 'rgba(255, 255, 255, 0.06)', text: '#9fbdd6', strokeWidth: 1 },
    ],
  },
  page: '#0e151b',
  font: SANS,
  series: ['#6fb3ff', '#c58bff', '#f2c14e', '#5ad07f', '#ff8a6b', '#4fd1c5', '#e58fb8', '#b0bec5'],
};

const LINE = '#e8f1ff';
const blueprint: DiagramTheme = {
  id: 'blueprint',
  name: 'Blueprint',
  roles: {
    default: { fill: '#1d4a85', stroke: LINE, text: LINE },
    accent: { fill: '#2560a8', stroke: '#ffe28a', text: '#ffffff' },
    muted: { fill: '#183f72', stroke: '#8fb1dc', text: '#b9cfee' },
    positive: { fill: '#1d4a85', stroke: '#8ff0b0', text: LINE },
    warning: { fill: '#1d4a85', stroke: '#ffd166', text: LINE },
    negative: { fill: '#1d4a85', stroke: '#ff9b9b', text: LINE },
  },
  defaultRole: 'default',
  edge: { stroke: LINE, width: 1.5, markerEnd: 'arrow' },
  label: { fill: LINE },
  container: { fill: 'rgba(232, 241, 255, 0.06)', stroke: '#8fb1dc', text: '#b9cfee', strokeWidth: 1, dash: [6, 4] },
  lane: {
    header: { fill: '#1d4a85', stroke: '#8fb1dc', text: LINE, strokeWidth: 1 },
    bodies: [
      { fill: 'rgba(232, 241, 255, 0.05)', stroke: '#8fb1dc', text: LINE, strokeWidth: 1 },
      { fill: 'rgba(232, 241, 255, 0)', stroke: '#8fb1dc', text: LINE, strokeWidth: 1 },
    ],
  },
  page: '#163a6b',
  font: { family: 'ui-monospace, monospace', size: 12 },
  series: ['#ffe28a', '#8ff0b0', '#9fd3ff', '#ffb38a', '#d9b8ff', '#7fe3d8', '#ff9b9b', '#c9d6e8'],
};

const PLUM = '#4a3b40';
const pastel: DiagramTheme = {
  id: 'pastel',
  name: 'Pastel',
  roles: {
    default: { fill: '#e3f0ff', stroke: '#7d9cc4', text: PLUM },
    accent: { fill: '#fde2e4', stroke: '#c9848f', text: PLUM },
    muted: { fill: '#f4f1ee', stroke: '#bfb5ad', text: '#8a7f78' },
    positive: { fill: '#dcf5e3', stroke: '#6fb487', text: PLUM },
    warning: { fill: '#fff1cc', stroke: '#d4a84a', text: PLUM },
    negative: { fill: '#ffdcd6', stroke: '#d77f73', text: PLUM },
  },
  defaultRole: 'default',
  edge: { stroke: '#8a7f99', width: 2, markerEnd: 'arrow' },
  label: { fill: PLUM },
  container: { fill: 'rgba(201, 132, 143, 0.06)', stroke: '#c9b8c2', text: '#7a6670', strokeWidth: 1, dash: [4, 3] },
  lane: {
    header: { fill: '#efe6f5', stroke: '#c9b8c2', text: PLUM, strokeWidth: 1 },
    bodies: [
      { fill: '#fffaf3', stroke: '#e6dccf', text: PLUM, strokeWidth: 1 },
      { fill: '#fbf3ea', stroke: '#e6dccf', text: PLUM, strokeWidth: 1 },
    ],
  },
  page: '#fffaf3',
  font: SANS,
  series: ['#7d9cc4', '#c9848f', '#d4a84a', '#6fb487', '#b48fd1', '#5fb3ad', '#e08fb0', '#a3a3a3'],
};

const BLACK = '#111111';
const shade = (fill: string): NodeStyle => ({ fill, stroke: BLACK, text: BLACK });
const mono: DiagramTheme = {
  id: 'mono',
  name: 'Mono',
  roles: {
    default: shade('#ffffff'),
    accent: shade('#d9d9d9'),
    muted: { fill: '#f5f5f5', stroke: '#9e9e9e', text: '#757575' },
    positive: shade('#ededed'),
    warning: shade('#c4c4c4'),
    negative: { fill: '#595959', stroke: BLACK, text: '#ffffff' },
  },
  defaultRole: 'default',
  edge: { stroke: BLACK, width: 1.5, markerEnd: 'arrow' },
  label: { fill: BLACK },
  container: { fill: 'rgba(0, 0, 0, 0.03)', stroke: '#757575', text: '#424242', strokeWidth: 1, dash: [4, 3] },
  lane: {
    header: { fill: '#e0e0e0', stroke: '#757575', text: BLACK, strokeWidth: 1 },
    bodies: [
      { fill: '#ffffff', stroke: '#bdbdbd', text: BLACK, strokeWidth: 1 },
      { fill: '#f5f5f5', stroke: '#bdbdbd', text: BLACK, strokeWidth: 1 },
    ],
  },
  page: '#ffffff',
  font: SANS,
  series: ['#111111', '#555555', '#888888', '#333333', '#777777', '#222222', '#666666', '#999999'],
};

/** The themes that ship, by id, in the order a picker lists them. `paper` is ink on white;
 *  `night` is the effect looks' own dark colors. */
export const DIAGRAM_THEMES: Readonly<Record<string, DiagramTheme>> = Object.freeze({ paper, night, blueprint, pastel, mono });
