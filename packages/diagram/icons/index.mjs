import { BPMN } from './bpmn.mjs';
import { CONNECTORS } from './connectors.mjs';
import { CONTAINERS } from './containers.mjs';
import { NETWORK } from './network.mjs';
import { MIND_MAP } from './mindMap.mjs';
import { ORG } from './org.mjs';
import { ERD, UML } from './modeling.mjs';

export const namespace = 'diagram';
export const owner = '@weasel-js/diagram';

export const groups = [
  ['Containers', CONTAINERS], ['Org chart', ORG], ['Network', NETWORK], ['BPMN', BPMN], ['UML', UML], ['ERD', ERD],
  ['Mind map', MIND_MAP], ['Connectors', CONNECTORS],
];
