import { f } from '@weasel-js/labkit/config';
import { meta, story } from '../story/define';
import { usePlayhead, useTimeline } from './context';

/** A story that declares a timeline: forge puts a transport under its trial and hands it the playhead. */
export default meta({});

const WIDTH = 240;
const R = 12;

function Ball({ period }: { period: number }) {
  const t = usePlayhead();
  const phase = (((t % period) + period) % period) / period;
  const x = R + (WIDTH - 2 * R) * (0.5 - 0.5 * Math.cos(phase * 2 * Math.PI));
  return (
    <svg width={WIDTH} height={R * 2} role="img" aria-label="A ball swinging with the playhead">
      <line x1={R} x2={WIDTH - R} y1={R} y2={R} stroke="currentColor" strokeOpacity={0.25} />
      <circle cx={x} cy={R} r={R} fill="currentColor" />
    </svg>
  );
}

/** The span is a function of a control, so changing the length re-spans the transport. */
export const Swing = story({
  config: f.schema({ seconds: f.number(4).range(1, 20).step(1) }),
  timeline: (config) => ({ duration: config.seconds * 1000 }),
  render: ({ config }) => <Ball period={config.seconds * 1000} />,
});

function LeadInReadout() {
  const { time, span } = useTimeline();
  return (
    <p>
      {time < 0 ? `Lead-in: ${(-time / 1000).toFixed(2)}s to go` : `Running: ${(time / 1000).toFixed(2)}s`} (span{' '}
      {span.start / 1000}s to {span.end / 1000}s)
    </p>
  );
}

/** A span starting below zero gives a lead-in, and one that does not loop stops at its end. */
export const LeadInOnce = story({
  timeline: { start: -1000, duration: 3000, loop: false },
  render: () => <LeadInReadout />,
});
