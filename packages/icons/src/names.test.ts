import { describe, expect, it } from 'vitest';
import { qualify, scopedIcon, splitIconRef, toIconRef } from './names';

describe('icon names', () => {
  it('qualifies a bare name against the package namespace', () => {
    const icon = scopedIcon<'undo'>('core');
    expect(icon('undo')).toBe('core:undo');
  });

  it('passes a qualified name through unchanged', () => {
    const icon = scopedIcon<'undo'>('core');
    expect(icon('ui:close' as never)).toBe('ui:close');
  });

  it('qualify never searches another namespace', () => {
    expect(qualify('core', 'close')).toBe('core:close');
  });

  it('splits a qualified ref, and refuses a bare or empty one', () => {
    expect(splitIconRef('path-tools:reversePath')).toEqual({ namespace: 'path-tools', name: 'reversePath' });
    expect(splitIconRef('undo')).toBeUndefined();
    expect(splitIconRef(':undo')).toBeUndefined();
    expect(splitIconRef('core:')).toBeUndefined();
  });

  it('toIconRef accepts only a qualified string', () => {
    expect(toIconRef('ui:close')).toBe('ui:close');
    expect(toIconRef('close')).toBeUndefined();
    expect(toIconRef(undefined)).toBeUndefined();
  });
});
