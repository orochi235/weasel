import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { ExtensionConflictError } from '@weasel-js/registry';
import { _resetPaintDrawKindsForTests, registerPaintDrawKind, type PaintDrawKind } from './paintKinds';
import {
  _resetProgramRegistryForTests, getProgramSource, registerProgram, type ProgramSource,
} from './shaders/registerProgram';

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

  it('leave every id as it was when one of them has no source', () => {
    registerPaintDrawKind(kind({ p: A }));
    expect(() => registerPaintDrawKind({ ...kind({ p: B, broken: {} as ProgramSource }), id: 'other' })).toThrow(/no source/);
    expect(getProgramSource('p')).toEqual(A);
  });

  it('refuse a program another kind id holds with other source, leaving that kind its program', () => {
    registerPaintDrawKind(kind({ p: A }));
    expect(() => registerPaintDrawKind({ ...kind({ p: B }), id: 'other' })).toThrow(ExtensionConflictError);
    expect(getProgramSource('p')).toEqual(A);
  });

  it('take a program back from a kind id that has been disposed', () => {
    registerPaintDrawKind(kind({ p: A }))();
    registerPaintDrawKind({ ...kind({ p: B }), id: 'other' });
    expect(getProgramSource('p')).toEqual(B);
  });

  it('refuse a program registerProgram holds with other source, leaving it in place', () => {
    registerProgram('p', A);
    expect(() => registerPaintDrawKind(kind({ p: B }))).toThrow(ExtensionConflictError);
    expect(getProgramSource('p')).toEqual(A);
  });

  it('leave a program registerProgram holds with the same source when the kind is disposed', () => {
    registerProgram('p', A);
    registerPaintDrawKind(kind({ p: A }))();
    expect(getProgramSource('p')).toEqual(A);
  });
});
