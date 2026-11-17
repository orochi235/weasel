import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { _resetPaintDrawKindsForTests, registerPaintDrawKind, type PaintDrawKind } from './paintKinds';
import { _resetProgramRegistryForTests, getProgramSource } from './shaders/registerProgram';

afterEach(() => {
  _resetPaintDrawKindsForTests();
  _resetProgramRegistryForTests();
});

const A = { glsl: { frag: 'void main() { /* a */ }' } };
const B = { glsl: { frag: 'void main() { /* b */ }' } };
const kind = (programs: PaintDrawKind['programs']): PaintDrawKind => ({ id: 'k', bind: () => null, programs });

describe('the shader programs a paint draw kind declares', () => {
  it('go back to the uncovered kind\'s when an override declaring other source is disposed', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    onTestFinished(() => warn.mockRestore());
    registerPaintDrawKind(kind({ p: A }));
    const off = registerPaintDrawKind(kind({ p: B }));
    expect(getProgramSource('p')).toEqual(B);
    off();
    expect(getProgramSource('p')).toEqual(A);
  });

  it('are released with a kind removed outright', () => {
    const off = registerPaintDrawKind(kind({ p: A }));
    off();
    expect(getProgramSource('p')).toBeNull();
  });

  it('stay while another registration of the same source holds them', () => {
    const first = registerPaintDrawKind(kind({ p: A }));
    registerPaintDrawKind({ ...kind({ p: A }), id: 'other' });
    first();
    expect(getProgramSource('p')).toEqual(A);
  });

  it('keep the live override\'s when a buried kind is disposed', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    onTestFinished(() => warn.mockRestore());
    const under = registerPaintDrawKind(kind({ p: A }));
    registerPaintDrawKind(kind({ p: B }));
    under();
    expect(getProgramSource('p')).toEqual(B);
  });
});
