import { describe, expect, it } from 'vitest';
import type { ModeDefinition } from './modeDefinition';
import { createModeRegistry } from './registry';

const mode = (id: string): ModeDefinition => ({ id, kind: 'soft', allows: [], scoping: false });

describe('createModeRegistry, shrunk', () => {
  it('lists the modes it was given, though the caller changes its list afterward', () => {
    const modes = [mode('constructor')];
    const reg = createModeRegistry({ modes, initial: 'constructor' });
    modes.push(mode('later'));
    expect(reg.list().map((m) => m.id)).toEqual(['constructor']);
  });
});
