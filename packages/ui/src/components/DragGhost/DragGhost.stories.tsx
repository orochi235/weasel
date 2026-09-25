import type { Meta, StoryObj } from '@weasel-js/forge';
import { type PointerEvent, useState } from 'react';
import { DragGhost } from './DragGhost';

const meta: Meta<typeof DragGhost> = {
  title: 'weasel-ui/DragGhost',
  component: DragGhost,
};
export default meta;
type Story = StoryObj<typeof DragGhost>;

/** Drag the chip: it stays where it is, and its ghost follows the pointer, keeping the point it was picked up by under
 *  it. `useReorderDragList` computes the same point for a list. */
export const FollowsThePointer: Story = {
  render: () => {
    function Chip() {
      const [ghost, setGhost] = useState<{ left: number; top: number; width: number } | null>(null);
      const [from, setFrom] = useState<HTMLElement | null>(null);
      const [grab, setGrab] = useState({ x: 0, y: 0 });
      const down = (e: PointerEvent<HTMLDivElement>) => {
        const r = e.currentTarget.getBoundingClientRect();
        e.currentTarget.setPointerCapture(e.pointerId);
        setGrab({ x: e.clientX - r.left, y: e.clientY - r.top });
        setGhost({ left: r.left, top: r.top, width: r.width });
      };
      const move = (e: PointerEvent<HTMLDivElement>) => {
        if (ghost) setGhost({ ...ghost, left: e.clientX - grab.x, top: e.clientY - grab.y });
      };
      return (
        <div
          ref={setFrom}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={() => setGhost(null)}
          style={{ width: 160, padding: '6px 10px', border: '1px solid currentColor', borderRadius: 4, cursor: 'grab', touchAction: 'none' }}
        >
          Drag me
          {ghost && from ? (
            <DragGhost at={ghost} from={from}>
              <div style={{ padding: '6px 10px' }}>Drag me</div>
            </DragGhost>
          ) : null}
        </div>
      );
    }
    return <Chip />;
  },
};
