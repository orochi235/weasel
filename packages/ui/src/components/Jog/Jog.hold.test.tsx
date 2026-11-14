import { vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { describeHold, unlessDisabled } from '../Disabled/testing/holdCases.fixtures';
import { Jog } from './Jog';

// Its step and play buttons are actions, held as disabled for the Jog's reason even when it is read-only; its scrubber
// is a slider, held as one.
describeHold('Jog', (mount, own) => {
  const onStep = vi.fn();
  const onPlay = vi.fn();
  const onScrub = vi.fn();
  mount(<Jog index={2} count={24} playing={false} onStep={onStep} onPlay={onPlay} onScrub={onScrub} {...own} />);
  const buttons = () => screen.getAllByRole('button');
  const scrubber = () => screen.getByRole('slider');
  return {
    targets: () => [...buttons(), scrubber()],
    described: () => [scrubber()],
    tryAll: () => {
      for (const b of buttons()) unlessDisabled(b, (el) => fireEvent.click(el));
      fireEvent.keyDown(scrubber(), { key: 'ArrowRight' });
    },
    changed: () => onStep.mock.calls.length + onPlay.mock.calls.length + onScrub.mock.calls.length > 0,
  };
}, { ariaHeld: false });
