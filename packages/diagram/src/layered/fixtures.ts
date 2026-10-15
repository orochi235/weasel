/** Test fixtures: diagrams the layered layout is measured on. */
import type { DiagramData } from '../fromData';

const node = (id: string, ...lines: string[]) => ({ id, lines: lines.length > 0 ? lines : [id] });

/** Shaped like blits' playground timing view of its `anchors` preset: two
 *  joins, a query, a long wire past the query, a group with a long label, and
 *  labeled wires into and out of the group's box. */
export const ANCHORS: DiagramData = {
  nodes: [
    node('voice:intro', 'intro', 'at 200 ms'),
    node('voice:glint', 'glint', 'at 300 ms'),
    node('mark:beat', 'beat', 'announced at 2000 ms'),
    node('query:spark', 'last tagged spark'),
    node('join:both:start', 'all of'),
    node('join:either:start', 'any of'),
    node('voice:both', 'both'),
    node('voice:either', 'either'),
    node('voice:one', 'one'),
    node('voice:two', 'two'),
    node('voice:outro', 'outro'),
  ],
  edges: [
    { from: 'voice:intro', to: 'join:both:start', label: 'after' },
    { from: 'mark:beat', to: 'join:both:start', label: 'with' },
    { from: 'join:both:start', to: 'voice:both', label: 'start' },
    { from: 'voice:both', to: 'group:pair', label: 'start after' },
    { from: 'group:pair', to: 'voice:outro', label: 'start its end +200 ms' },
    { from: 'voice:intro', to: 'join:either:start', label: 'after' },
    { from: 'voice:glint', to: 'query:spark' },
    { from: 'query:spark', to: 'join:either:start', label: 'after +100 ms' },
    { from: 'join:either:start', to: 'voice:either', label: 'start' },
    { from: 'voice:one', to: 'voice:two', label: 'then' },
  ],
  groups: [{ id: 'group:pair', label: 'pair · span, one after another', members: ['voice:one', 'voice:two'] }],
};
