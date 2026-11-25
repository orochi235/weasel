import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import type { ModeDefinition, ModeRegistry } from '@weasel-js/modes';
import { DepRegistryProvider, useDepRegistry, type DepRegistry } from '@weasel-js/routing/react';
import { useModeDefaultToolDepSource } from './modeDefaultTool';

const modesNaming = (defaultTool: string) =>
  ({ current: () => ({ id: 'm', defaultTool } as unknown as ModeDefinition) }) as unknown as ModeRegistry;

const tools = { registry: { select: {} }, has: (id: string) => id === 'select' || id === 'grid', ambient: [{ id: 'grid' }] } as never;

function Wire({ modes, onR }: { modes: ModeRegistry; onR: (r: DepRegistry) => void }) {
  useModeDefaultToolDepSource(modes, tools);
  onR(useDepRegistry());
  return null;
}

function depFor(defaultTool: string): string | null | undefined {
  let reg!: DepRegistry;
  render(<DepRegistryProvider><Wire modes={modesNaming(defaultTool)} onR={(r) => { reg = r; }} /></DepRegistryProvider>);
  return reg.get('modeDefaultTool')?.();
}

describe('useModeDefaultToolDepSource', () => {
  it('answers a registry tool the mode names', () => {
    expect(depFor('select')).toBe('select');
  });

  it('answers null for an ambient tool, which cannot be made active', () => {
    expect(depFor('grid')).toBeNull();
  });
});
