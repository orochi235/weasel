import type { TimelineSpec } from './clock';

const isSpec = (value: unknown): value is TimelineSpec =>
  !!value && typeof value === 'object' && typeof (value as { duration?: unknown }).duration === 'number';

/** A declared timeline as a function of config: a spec stands for itself at every config, a function is called with
 *  the config. Anything else declares none. `adapt` turns the trial's config into what the function is handed. */
export function timelineOf(
  value: unknown,
  adapt: (config: unknown) => unknown = (config) => config,
): ((config: unknown) => TimelineSpec) | null {
  if (isSpec(value)) return () => value;
  if (typeof value === 'function') return (config) => (value as (input: unknown) => TimelineSpec)(adapt(config));
  return null;
}
