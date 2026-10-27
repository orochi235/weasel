import { CLOCK_RATES } from './rates';
import type { ClockSpec } from './types';

export const checkDuration = (duration: number): void => {
  if (!(duration > 0)) throw new RangeError(`a clock's duration is positive, not ${duration}`);
};

export const ratesOf = (spec: ClockSpec): number[] => {
  const rates = [...(spec.rates ?? CLOCK_RATES)].sort((a, b) => a - b);
  if (rates.length === 0 || rates.some((r) => !(r > 0) || !Number.isFinite(r)))
    throw new RangeError('a clock offers at least one rate, each finite and positive');
  return rates;
};

export const checkRate = (rate: number, seekable: boolean): void => {
  if (!Number.isFinite(rate)) throw new RangeError(`a clock's rate is finite, not ${rate}`);
  if (rate < 0 && !seekable)
    throw new RangeError('a clock that is not seekable cannot run backward');
};

export const checkSpeed = (speed: number): void => {
  if (!(speed > 0) || !Number.isFinite(speed))
    throw new RangeError(`a clock's speed is finite and positive, not ${speed}`);
};

export const checkOrigin = (origin: number): void => {
  if (!Number.isFinite(origin)) throw new RangeError(`a clock's origin is finite, not ${origin}`);
};
