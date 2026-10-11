import { describe, expect, it, vi } from 'vitest';

describe('the composite program', () => {
  it('is registered when a draw asks for it, not when the module loads', async () => {
    vi.resetModules();
    const programs = await import('../shaders/registerProgram');
    const composite = await import('./composite');
    expect(programs.getProgramSource(composite.COMPOSITE_PROGRAM_ID)).toBeNull();
    expect(composite.compositeProgramId()).toBe(composite.COMPOSITE_PROGRAM_ID);
    expect(programs.getProgramSource(composite.COMPOSITE_PROGRAM_ID)).not.toBeNull();
  });

  it('comes back after the program registry is cleared', async () => {
    const programs = await import('../shaders/registerProgram');
    const composite = await import('./composite');
    composite.compositeProgramId();
    programs._resetProgramRegistryForTests();
    composite.compositeProgramId();
    expect(programs.getProgramSource(composite.COMPOSITE_PROGRAM_ID)).not.toBeNull();
  });
});
