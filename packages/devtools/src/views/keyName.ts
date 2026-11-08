/** How a trace names a key: as `KeyboardEvent.key` has it, but the space bar by name. */
export const keyName = (key: string): string => (key === ' ' ? 'Space' : key);
