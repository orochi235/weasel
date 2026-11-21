import { keyLegendFromKey } from '@weasel-js/gestures';

/** How the panel names a key, in a trace row, a diagram's input and a route strip alike: its text legend. */
export const keyName = (key: string): string => keyLegendFromKey(key, { legend: 'text' }).label;
