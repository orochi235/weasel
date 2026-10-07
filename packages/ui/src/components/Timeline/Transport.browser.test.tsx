import '@weasel-js/theme/tokens.css';
import '@weasel-js/theme/fonts.css';
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { Transport, type TransportProps } from './Transport';

// A transport sized to its content beside a greedy scrub bar, as astv's labs
// lay it out: whatever the readouts gain, the transport gains, and the bar loses.

afterEach(cleanup);

const base: TransportProps = {
  paused: true,
  loop: false,
  rate: 1,
  playhead: 9990,
  duration: 12000,
  onPlay: () => {},
  onPause: () => {},
  onLoopChange: () => {},
  onRateChange: () => {},
};

async function widthAt(props: Partial<TransportProps>): Promise<number> {
  const { container, unmount } = render(
    <div style={{ display: 'flex', width: 900 }}>
      <div style={{ flex: 1 }} />
      <div style={{ flex: 'none' }}>
        <Transport {...base} {...props} />
      </div>
    </div>,
  );
  await document.fonts.ready;
  const w = (container.firstElementChild!.lastElementChild as HTMLElement).getBoundingClientRect().width;
  unmount();
  return w;
}

test('the transport keeps its width as the playhead gains a digit', async () => {
  expect(await widthAt({ playhead: 10000 })).toBe(await widthAt({ playhead: 9990 }));
});

test('the scrub bar takes the slack of a transport given room', async () => {
  const { getByRole } = render(
    <div style={{ width: 900 }}>
      <Transport {...base} onSeek={() => {}} onReverseChange={() => {}} />
    </div>,
  );
  await document.fonts.ready;
  const transport = getByRole('switch', { name: 'Reverse' }).parentElement as HTMLElement;
  const thumb = getByRole('slider', { name: 'Position' });
  const scrub = [...transport.children].find((el) => el.contains(thumb)) as HTMLElement;
  expect(scrub.getBoundingClientRect().width).toBeGreaterThan(300);
});

test('the transport keeps its width across rates of different lengths', async () => {
  const at1 = await widthAt({ rate: 1 });
  for (const rate of [0.25, 0.5, 2, 4]) expect(await widthAt({ rate })).toBe(at1);
});
