import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import { Stage } from '../canvas/Stage';
import type { ViewTransform } from '../instrument/types';
import { TrialOverview } from './TrialOverview';

const meta: Meta<typeof TrialOverview> = {
  title: 'labkit/Overview/TrialOverview',
  component: TrialOverview,
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj<typeof TrialOverview>;

const SIZE = { width: 640, height: 420 };
const DOTS = [40, 120, 200, 280, 360, 440, 520, 600];

/** A picture bigger than the stage at 2×, so there is somewhere to go. */
function Picture() {
  return (
    <svg viewBox="0 0 640 420" width={SIZE.width} height={SIZE.height} role="img" aria-label="Grid">
      <title>Grid</title>
      <rect width="640" height="420" fill="#f4f1ea" />
      {DOTS.map((x, i) => (
        <circle key={x} cx={x} cy={40 + i * 48} r="24" fill="#8b98a8" />
      ))}
    </svg>
  );
}

function Harness() {
  const [view, setView] = useState<ViewTransform>({ zoom: 2, pan: { x: -200, y: -120 } });
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <Stage
        size={SIZE}
        view={view}
        onViewChange={setView}
        overlay={<TrialOverview width={200} height={140} render={() => <Picture />} />}
      >
        <Picture />
      </Stage>
    </div>
  );
}

export const Default: Story = {
  render: () => <Harness />,
};
