import { BPMN } from './bpmn.mjs';
import { CONTAINERS } from './containers.mjs';
import { NETWORK } from './network.mjs';

export const namespace = 'diagram';
export const owner = '@weasel-js/diagram';

export const groups = [['Containers', CONTAINERS], ['Network', NETWORK], ['BPMN', BPMN]];
