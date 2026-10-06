import { defineInstrument, Lab, usePresentation } from '@weasel-js/labkit';
import { Button } from '@weasel-js/ui';
// In-repo, so the source stylesheet: a consumer imports the built
// `@weasel-js/labkit/styles.css` instead.
import '@weasel-js/labkit/styles.less';
import 'windease/styles.css';
import './PresentationDemo.css';

const LENGTH = 150;

const pendulum = defineInstrument({
  name: 'Pendulum',
  initialState: () => ({}),
  defaultConfig: () => ({ swing: 0.6 }),
  clock: { duration: 2000, loop: true, rate: 1 },
  canvas: {
    initialView: (size) => ({ zoom: 1, pan: { x: size.width / 2, y: size.height / 3 } }),
    layers: [
      {
        id: 'bob',
        timed: true,
        draw: (ctx, { phase, config }) => {
          const angle = Math.sin(phase * Math.PI * 2) * config.swing;
          const x = Math.sin(angle) * LENGTH;
          const y = Math.cos(angle) * LENGTH;
          ctx.strokeStyle = '#888';
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(x, y);
          ctx.stroke();
          ctx.fillStyle = '#8e4ec6';
          ctx.beginPath();
          ctx.arc(x, y, 18, 0, Math.PI * 2);
          ctx.fill();
        },
      },
    ],
  },
  render: () => null,
});

/** In the lab's header, so it is hidden with the rest of the chrome. */
function PresentButton() {
  const { enter } = usePresentation();
  return <Button onClick={enter}>Present</Button>;
}

export function PresentationDemo() {
  return (
    <div className="ckd-lab-frame prd-host">
      <Lab title="Presentation" instruments={[pendulum]} defaultInstrument="Pendulum">
        <PresentButton />
      </Lab>
    </div>
  );
}
