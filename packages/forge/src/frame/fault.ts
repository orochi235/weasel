import type { FaultPhase, FromFrame } from '../protocol/messages';

/** The `fault` message for an error thrown in `phase`; `seq` names the input it answers, when there was one. */
export function fault(phase: FaultPhase, error: unknown, seq?: number): FromFrame {
  return {
    type: 'fault',
    phase,
    message: error instanceof Error ? error.message : String(error),
    ...(error instanceof Error && error.stack ? { stack: error.stack } : {}),
    ...(seq === undefined ? {} : { seq }),
  };
}
