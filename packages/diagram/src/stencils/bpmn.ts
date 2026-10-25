import { icon } from '../icons.gen';
import type { StencilGroup } from '../diagramTypes/types';
import { EVENT_SIZE, GATEWAY_SIZE } from '../outlines/bpmn';
import type { DiagramStencil } from '../stencil';

/** An end event's ring, heavier than the theme's stroke. */
const END_EVENT_STROKE = 4;

/** BPMN's events, activities, gateways, and data. Pools come from the containers group. */
export const BPMN_STENCILS: readonly DiagramStencil[] = [
  { id: 'start-event', label: 'Start event', outline: 'event', size: EVENT_SIZE, icon: icon('startEvent') },
  { id: 'intermediate-event', label: 'Intermediate event', outline: 'intermediateEvent', size: EVENT_SIZE, icon: icon('intermediateEvent') },
  {
    id: 'end-event', label: 'End event', outline: 'event', size: EVENT_SIZE, icon: icon('endEvent'),
    style: { strokeWidth: END_EVENT_STROKE },
  },
  { id: 'task', label: 'Task', outline: 'roundRect', size: { width: 120, height: 70 }, icon: icon('task') },
  { id: 'subprocess', label: 'Subprocess', outline: 'subprocess', size: { width: 120, height: 80 }, icon: icon('subprocess') },
  { id: 'exclusive-gateway', label: 'Exclusive gateway', outline: 'exclusiveGateway', size: GATEWAY_SIZE, icon: icon('exclusiveGateway') },
  { id: 'parallel-gateway', label: 'Parallel gateway', outline: 'parallelGateway', size: GATEWAY_SIZE, icon: icon('parallelGateway') },
  { id: 'inclusive-gateway', label: 'Inclusive gateway', outline: 'inclusiveGateway', size: GATEWAY_SIZE, icon: icon('inclusiveGateway') },
  { id: 'event-gateway', label: 'Event-based gateway', outline: 'eventGateway', size: GATEWAY_SIZE, icon: icon('eventGateway') },
  { id: 'data-object', label: 'Data object', outline: 'note', size: { width: 60, height: 80 }, icon: icon('dataObject') },
  { id: 'data-store', label: 'Data store', outline: 'cylinder', size: { width: 80, height: 80 }, icon: icon('dataStore') },
];

/** The BPMN symbols as a stencil group. */
export const BPMN_GROUP: StencilGroup = { id: 'bpmn', label: 'BPMN', stencils: BPMN_STENCILS };
