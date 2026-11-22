import '@weasel-js/theme/tokens.css';
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import type { Track } from '@weasel-js/animator';
import { Timeline } from '@weasel-js/ui/components/Timeline';

afterEach(cleanup);

const tracks = [
  { kind: 'sampled', label: 'x', keys: [{ t: 0, value: 0 }, { t: 900, value: 1 }, { t: 1500, value: 2 }], onTick: () => {} },
  { kind: 'timeline', label: 'n', at: 600, timeline: { duration: 1000, tracks: [] } },
] as unknown as Track[];

test('marks before the window start leave the label column to its labels', () => {
  const { getAllByTestId, getByTestId } = render(
    <div style={{ width: 600 }}>
      <Timeline tracks={tracks} duration={2000} playhead={0} window={{ from: 1000, to: 2000 }} onChange={() => {}} onSeek={() => {}} />
    </div>,
  );
  const early = getAllByTestId('timeline-key')[1]!.getBoundingClientRect();
  const track = getAllByTestId('timeline-lane-track')[0]!.getBoundingClientRect();
  expect(early.right).toBeLessThan(track.left);
  const atKey = document.elementFromPoint(early.left + early.width / 2, early.top + early.height / 2);
  expect(atKey?.closest('[data-keyframe-index], [data-segment-index]')).toBeNull();

  const bar = getByTestId('timeline-nested').getBoundingClientRect();
  const nestedTrack = getAllByTestId('timeline-lane-track')[1]!.getBoundingClientRect();
  const atDisclosure = document.elementFromPoint(nestedTrack.left - 30, bar.top + bar.height / 2);
  expect(atDisclosure?.closest('[data-testid="timeline-nested"]')).toBeNull();
});
