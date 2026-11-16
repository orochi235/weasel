import type { Meta, StoryObj } from '@weasel-js/forge';
import { startThresholdDrag } from '@weasel-js/routing';
import { type PointerEvent as ReactPointerEvent, useState } from 'react';
import { DragGhost } from '@weasel-js/ui/components/DragGhost';
import s from './DragGhost.stories.module.css';

const meta: Meta<typeof DragGhost> = {
  title: 'ui/DragGhost',
  component: DragGhost,
};
export default meta;
type Story = StoryObj<typeof DragGhost>;

/** Drag the chip: it stays where it is, and its ghost follows the pointer, keeping the point it was picked up by under
 *  it. `useReorderDragList` computes the same point for a list. */
export const FollowsThePointer: Story = {
  render: (args) => {
    function Chip() {
      const [ghost, setGhost] = useState<{ left: number; top: number; width: number } | null>(null);
      const [from, setFrom] = useState<HTMLElement | null>(null);
      const press = (e: ReactPointerEvent<HTMLDivElement>) => {
        const r = e.currentTarget.getBoundingClientRect();
        const grab = { x: e.clientX - r.left, y: e.clientY - r.top };
        const follow = (ev: PointerEvent) => setGhost({ left: ev.clientX - grab.x, top: ev.clientY - grab.y, width: r.width });
        startThresholdDrag(e, { onActivate: follow, onMove: follow, onCommit: () => setGhost(null), onCancel: () => setGhost(null) });
      };
      return (
        <div ref={setFrom} className={s.chip} onPointerDown={press}>
          Drag me
          {ghost && from ? (
            <DragGhost {...args} at={ghost} from={from}>
              <div className={s.face}>Drag me</div>
            </DragGhost>
          ) : null}
        </div>
      );
    }
    return <Chip />;
  },
};
