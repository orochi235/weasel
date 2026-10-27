/** What a draw-style XML style name means in a diagram, read and written from the one table each. */
import type { MarkerRef } from '@weasel-js/core';
import type { Outline } from '@weasel-js/diagram';

/** The arc size, in percent, at and past which a rounded rect has round ends and reads as a stadium. */
export const STADIUM_ARC = 50;

type StylePart = string | [string, string | number];

/** A figure drawn over its label, as BPMN's events and gateways and the network devices are. */
const LABEL_BELOW: StylePart[] = [['verticalLabelPosition', 'bottom'], ['verticalAlign', 'top']];
const event = (outline: string): StylePart[] =>
  [['shape', 'mxgraph.bpmn.event'], ['outline', outline], ['symbol', 'general'], ...LABEL_BELOW];
const gateway = (...parts: StylePart[]): StylePart[] => [['shape', 'mxgraph.bpmn.gateway2'], ...parts, ...LABEL_BELOW];
const device = (name: string): StylePart[] => [['shape', `mxgraph.networks.${name}`], ...LABEL_BELOW];

/**
 * Shapes by their style name, each with the style that writes it back. `when` narrows a name to the
 * cells whose style also holds that pair; an entry without `write` is read only. Read takes the first
 * entry that matches, write the first that names the outline.
 */
export const SHAPES: ReadonlyArray<{
  name: string;
  when?: readonly [string, string];
  outline: Exclude<Outline, object>;
  write?: readonly StylePart[];
}> = [
  { name: 'rhombus', outline: 'diamond', write: ['rhombus'] },
  { name: 'ellipse', outline: 'ellipse', write: ['ellipse'] },
  { name: 'hexagon', outline: 'hexagon', write: [['shape', 'hexagon'], ['perimeter', 'hexagonPerimeter2'], ['size', 0.2]] },
  { name: 'parallelogram', outline: 'parallelogram', write: [['shape', 'parallelogram'], ['perimeter', 'parallelogramPerimeter'], ['size', 0.2]] },
  {
    name: 'trapezoid', outline: 'trapezoid',
    write: [['shape', 'trapezoid'], ['perimeter', 'trapezoidPerimeter'], ['direction', 'north'], ['size', 0.25]],
  },
  { name: 'cylinder3', outline: 'cylinder', write: [['shape', 'cylinder3'], ['boundedLbl', 1], ['backgroundOutline', 1], ['size', 15]] },
  { name: 'document', outline: 'document', write: [['shape', 'document'], ['boundedLbl', 1]] },
  { name: 'note', outline: 'note', write: [['shape', 'note'], ['size', 20]] },
  { name: 'cloud', outline: 'cloud', write: ['ellipse', ['shape', 'cloud']] },
  { name: 'triangle', outline: 'triangle', write: ['triangle', ['direction', 'north']] },
  { name: 'cube', outline: 'cube', write: [['shape', 'cube'], ['boundedLbl', 1], ['flipH', 1]] },
  { name: 'folder', outline: 'folder', write: [['shape', 'folder'], ['tabPosition', 'left']] },
  { name: 'umlActor', outline: 'actor', write: [['shape', 'umlActor'], ['verticalLabelPosition', 'bottom'], ['verticalAlign', 'top']] },
  { name: 'doubleEllipse', outline: 'doubleEllipse', write: ['ellipse', ['shape', 'doubleEllipse']] },
  { name: 'mxgraph.bpmn.event', when: ['outline', 'standard'], outline: 'event', write: event('standard') },
  { name: 'mxgraph.bpmn.event', when: ['outline', 'catching'], outline: 'intermediateEvent', write: event('catching') },
  { name: 'mxgraph.bpmn.event', when: ['outline', 'throwing'], outline: 'intermediateEvent' },
  { name: 'mxgraph.bpmn.event', outline: 'event' },
  // As draw.io's own BPMN palette (Sidebar-BPMN.js) writes them: only exclusive, parallel and complex are a `gwType`;
  // the default, `event`, draws the event `outline` and `symbol` name inside the diamond.
  { name: 'mxgraph.bpmn.gateway2', when: ['gwType', 'exclusive'], outline: 'exclusiveGateway', write: gateway(['outline', 'none'], ['symbol', 'none'], ['gwType', 'exclusive']) },
  { name: 'mxgraph.bpmn.gateway2', when: ['gwType', 'parallel'], outline: 'parallelGateway', write: gateway(['outline', 'none'], ['symbol', 'none'], ['gwType', 'parallel']) },
  { name: 'mxgraph.bpmn.gateway2', when: ['gwType', 'complex'], outline: 'diamond' },
  { name: 'mxgraph.bpmn.gateway2', when: ['outline', 'end'], outline: 'inclusiveGateway', write: gateway(['outline', 'end'], ['symbol', 'general']) },
  { name: 'mxgraph.bpmn.gateway2', when: ['outline', 'catching'], outline: 'eventGateway', write: gateway(['outline', 'catching'], ['symbol', 'multiple']) },
  // What this package wrote before 2026-10-27, which draw.io draws as a bare diamond.
  { name: 'mxgraph.bpmn.gateway2', when: ['gwType', 'inclusive'], outline: 'inclusiveGateway' },
  { name: 'mxgraph.bpmn.gateway2', when: ['gwType', 'eventBased'], outline: 'eventGateway' },
  { name: 'mxgraph.bpmn.gateway2', outline: 'diamond' },
  {
    name: 'mxgraph.bpmn.task', when: ['isLoopSub', '1'], outline: 'subprocess',
    write: [['shape', 'mxgraph.bpmn.task'], ['taskMarker', 'abstract'], ['isLoopSub', 1], ['rounded', 1]],
  },
  { name: 'mxgraph.networks.server', outline: 'server', write: device('server') },
  { name: 'mxgraph.networks.router', outline: 'router', write: device('router') },
  { name: 'mxgraph.networks.switch', outline: 'switch', write: device('switch') },
  { name: 'mxgraph.networks.firewall', outline: 'firewall', write: device('firewall') },
  { name: 'mxgraph.networks.laptop', outline: 'laptop', write: device('laptop') },
  { name: 'mxgraph.networks.pc', outline: 'desktop', write: device('pc') },
  { name: 'mxgraph.networks.mobile', outline: 'phone', write: device('mobile') },
  { name: 'mxgraph.networks.printer', outline: 'printer', write: device('printer') },
  { name: 'mxgraph.networks.user_male', outline: 'user', write: device('user_male') },
  // mxgraph.networks has no globe; this is the Office set's.
  { name: 'mxgraph.office.concepts.globe_internet', outline: 'globe', write: [['shape', 'mxgraph.office.concepts.globe_internet'], ...LABEL_BELOW] },
];

/** The entry a cell's style reads as: its shape name, and the pair that narrows it where one does. */
export function shapeEntry(name: string | undefined, value: (key: string) => string | undefined): (typeof SHAPES)[number] | undefined {
  return SHAPES.find((s) => s.name === name && (s.when === undefined || value(s.when[0]) === s.when[1]));
}

/** Style names that draw a plain box. */
export const BOX_NAMES: ReadonlySet<string> = new Set(['rect', 'rectangle', 'text', 'label']);

/** Edge styles that route at right angles. */
export const ORTHOGONAL_EDGE_STYLES: ReadonlySet<string> = new Set(['orthogonalEdgeStyle', 'elbowEdgeStyle', 'entityRelationEdgeStyle']);

/** Arrowheads by their style name, and whether a `Fill` of `0` makes one hollow. */
const MARKERS_READ: Readonly<Record<string, { filled: MarkerRef; hollow?: MarkerRef }>> = {
  classic: { filled: 'arrow' }, classicThin: { filled: 'arrow' }, block: { filled: 'arrow', hollow: 'triangle-hollow' },
  blockThin: { filled: 'arrow', hollow: 'triangle-hollow' }, open: { filled: 'arrow-open' }, openThin: { filled: 'arrow-open' },
  diamond: { filled: 'diamond', hollow: 'diamond-hollow' }, diamondThin: { filled: 'diamond', hollow: 'diamond-hollow' },
  oval: { filled: 'circle' }, box: { filled: 'square' }, dash: { filled: 'bar' },
  ERone: { filled: 'bar' }, ERmandOne: { filled: 'crow-one' }, ERmany: { filled: 'crow-many' },
  ERzeroToOne: { filled: 'crow-zero-one' }, ERoneToMany: { filled: 'crow-one-many' }, ERzeroToMany: { filled: 'crow-zero-many' },
};

/** The marker an arrowhead style name draws as, `null` for none, or `undefined` for a name it does not know. */
export function markerOf(name: string, fill: string | undefined): MarkerRef | null | undefined {
  if (name === 'none' || name === '') return null;
  const known = MARKERS_READ[name];
  if (known === undefined) return undefined;
  return fill === '0' && known.hollow !== undefined ? known.hollow : known.filled;
}

const MARKERS_WRITE: Readonly<Record<string, readonly [string, 0 | 1]>> = {
  'arrow': ['block', 1], 'arrow-concave': ['classic', 1], 'arrow-open': ['open', 0], 'diamond': ['diamond', 1],
  'diamond-hollow': ['diamond', 0], 'circle': ['oval', 1], 'square': ['box', 1], 'bar': ['dash', 1],
  'triangle-hollow': ['block', 0], 'crow-one': ['ERmandOne', 0], 'crow-many': ['ERmany', 0],
  'crow-zero-one': ['ERzeroToOne', 0], 'crow-one-many': ['ERoneToMany', 0], 'crow-zero-many': ['ERzeroToMany', 0],
};

/** The arrowhead style name and fill a marker writes as; `undefined` for a marker the format has none like. */
export function markerStyle(marker: MarkerRef | null | undefined): readonly [string, 0 | 1] | undefined {
  if (marker === null || marker === undefined) return ['none', 1];
  return MARKERS_WRITE[typeof marker === 'string' ? marker : marker.key];
}
