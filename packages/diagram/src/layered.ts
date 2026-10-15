/**
 * `layered` — ranks running one way, nodes running across.
 *
 * The flowchart / pipeline layout: an edge points from one rank to the next.
 * The steps live in `./layered/`: edges closing a cycle are turned around
 * (`cycles`), ranks are chosen to keep edges short (`rank`), an edge spanning
 * ranks gets a placeholder in each rank it crosses (`expand`), each rank is
 * ordered (`order`), and nodes are lined up with their neighbors (`place`).
 * `plan` puts it together.
 *
 * Under `order: 'seeded'` (the default) each rank keeps the order its nodes
 * already sit in, so a re-run moves nothing. `order: 'barycenter'` reorders to
 * cut crossings, and adds the placeholders whose positions route long edges.
 */
import type { LayoutFn } from './layout';
import { layeredPlan } from './layered/plan';

export { backEdges, ranksOf } from './layered/cycles';
export { layeredPlan, type LayeredPlan } from './layered/plan';
export { ranksByLength } from './layered/rank';

/** The ranked layout: each edge points one rank further along `direction`.
 *  Under `order: 'seeded'` a re-run moves nothing; `order: 'barycenter'`
 *  reorders ranks to cut crossings. */
export const layered: LayoutFn = (graph, opts = {}) => layeredPlan(graph, opts).moves;
