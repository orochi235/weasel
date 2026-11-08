import { isDev } from '@weasel-js/react';
import {
  type FrameOptions,
  frames,
  Sequence,
  type SequenceProps,
} from '@weasel-js/ui/components/Sequence';
import { type ReactElement, type ReactNode, useEffect, useMemo, useState } from 'react';
import { TrialClockContext } from './contexts';
import { runs, runTo } from './runTo';
import { type ClockCapability, createTrialClock, type TrialClockHandle } from './trialClock';

export interface HeldClockProps {
  /** The clock to open, as an instrument declares it. */
  spec: ClockCapability;
  /** ms into the run it stands at, paused. */
  at: number;
  children: ReactNode;
}

function holdAt(spec: ClockCapability, at: number): TrialClockHandle {
  const handle = createTrialClock({ ...spec, rate: 0 });
  if (handle.clock.seekable) handle.clock.seek(at);
  else if (runs(handle)) runTo(handle.clock, at, handle.step);
  else if (isDev())
    console.warn(
      `[labkit] a clock held at ${at}ms that is not seekable stays where it opens; a \`step\` in its declaration runs it there`,
    );
  return handle;
}

/** Whether two declarations open the same clock; `mix` aside, which is made anew with each. */
function sameDeclaration(a: ClockCapability, b: ClockCapability): boolean {
  return (
    a.duration === b.duration &&
    a.loop === b.loop &&
    a.origin === b.origin &&
    a.start === b.start &&
    a.speed === b.speed &&
    a.seekable === b.seekable &&
    a.step === b.step &&
    String(a.rates) === String(b.rates)
  );
}

/** `spec`, kept the same object while it declares the same clock, as one written inline is new each render. */
function useDeclared(spec: ClockCapability): ClockCapability {
  const [kept, setKept] = useState(spec);
  const current = kept === spec || sameDeclaration(kept, spec) ? kept : spec;
  if (current !== kept) setKept(current);
  return current;
}

/**
 * A clock of its own for what renders inside, opened from `spec` and paused at
 * `at`: `useTrialClock` and `useClockFrame` there read it in place of the
 * trial's. A clock that is not seekable is run there from its start, `step` ms
 * a frame. It joins no registry, so the lab's transport and a still leave it be.
 */
export function HeldClock({ spec, at, children }: HeldClockProps): ReactElement {
  const declared = useDeclared(spec);
  const handle = useMemo(() => holdAt(declared, at), [declared, at]);
  // Children's effects run first, so their frame listeners hear this one sync.
  useEffect(() => handle.clock.sync(performance.now()), [handle]);
  return <TrialClockContext.Provider value={handle}>{children}</TrialClockContext.Provider>;
}

export type ClockFramesProps = Omit<SequenceProps<number>, 'sweep' | 'across' | 'children'> &
  Omit<FrameOptions, 'label'> & {
    spec: ClockCapability;
    /** What each frame shows; anything in it reading the trial's clock reads the frame's. */
    children: ReactNode | ((elapsed: number) => ReactNode);
  };

/** The frames of `spec`'s run, `every` ms apart, each under a {@link HeldClock} at its time. */
export function ClockFrames({
  spec,
  every,
  passes,
  children,
  ...rest
}: ClockFramesProps): ReactElement {
  const declared = useDeclared(spec);
  const sweep = useMemo(
    () => frames(declared, { every, ...(passes ? { passes } : {}) }),
    [declared, every, passes],
  );
  return (
    <Sequence {...rest} sweep={sweep}>
      {(t) => (
        <HeldClock spec={declared} at={t}>
          {typeof children === 'function' ? children(t) : children}
        </HeldClock>
      )}
    </Sequence>
  );
}
