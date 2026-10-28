import { MOVE_NODES_REQUIRES, moveNodes, type ActionDeps, type Contribution, type RectPose } from '@weasel-js/core';
import { itemDropContribution, stencilKind, type ItemDrop, type ParticipantSource } from '@weasel-js/diagram';

type Point = { x: number; y: number };

const DROP_REQUIRES = ['insert', 'snap', ...MOVE_NODES_REQUIRES] as const;

/** How far a move of `id` pressed at `press` snaps it before it has moved. */
function landingDelta(deps: ActionDeps, id: string, press: Point): { dx: number; dy: number } {
  if (!deps.snap) return { dx: 0, dy: 0 };
  const session = deps.snap.begin({ gesture: 'move', press, ids: [id] });
  try {
    const landed = session.at(press, { suspend: false, constrain: false }).point;
    return { dx: landed.x - press.x, dy: landed.y - press.y };
  } finally {
    session.end();
  }
}

/** Inserts the stencil `drop` carries centered on the drop point, through the `insert` dep, then moves it as far
 *  as a move of it from there would snap it: one undo step. */
function dropStencil(drop: ItemDrop, deps: ActionDeps): void {
  const { insert, scene } = deps;
  if (typeof drop.item !== 'string' || !insert || !scene) return;
  const kind = stencilKind(drop.item);
  const { at } = drop;
  scene.batch('Drop', () => {
    const id = insert.commit({ x: at.x, y: at.y, width: 0, height: 0 }, { kind });
    if (id !== null) moveNodes(deps, [id], landingDelta(deps, id, at), 'Drop');
  });
}

/** Takes a stencil carried in from the Shapes panel, outlining what it would land in on the way. Its item is the
 *  stencil's id. */
export function stencilDrop(participants: ParticipantSource<RectPose>): Contribution {
  return itemDropContribution({ participants, requires: DROP_REQUIRES, report: dropStencil });
}
