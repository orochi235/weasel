import { CONTAINERS } from './containers.mjs';
import { MIND_MAP } from './mindMap.mjs';
import { ORG } from './org.mjs';

export const namespace = 'diagram';
export const owner = '@weasel-js/diagram';

export const groups = [['Containers', CONTAINERS], ['Org chart', ORG], ['Mind map', MIND_MAP]];
