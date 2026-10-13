import { describe, it, expect } from 'vitest';
import { eligibleTool } from './eligibility';
import { createModeRegistry } from './registry';
import { DEFAULT_MODES } from './presets/default';

const reg = createModeRegistry({ modes: DEFAULT_MODES, initial: 'normal' });

describe('eligibleTool', () => {
  it('returns true in normal for a selection tool', () => {
    expect(eligibleTool(reg, { id: 't', capabilities: ['creates-selection'] })).toBe(true);
  });

  it('returns true for navigation tools in any mode (implicit tag)', () => {
    const r2 = createModeRegistry({ modes: DEFAULT_MODES, initial: 'path-edit' });
    expect(eligibleTool(r2, { id: 'hand', capabilities: ['navigation'] })).toBe(true);
    expect(eligibleTool(r2, { id: 'zoom', capabilities: ['navigation'] })).toBe(true);
  });

  it('returns false in path-edit for selection tools', () => {
    const r2 = createModeRegistry({ modes: DEFAULT_MODES, initial: 'path-edit' });
    expect(eligibleTool(r2, { id: 'sel', capabilities: ['creates-selection'] })).toBe(false);
  });

  it('an untagged tool is eligible in every mode', () => {
    const r2 = createModeRegistry({ modes: DEFAULT_MODES, initial: 'path-edit' });
    expect(eligibleTool(r2, { id: 'mystery' })).toBe(true);
    expect(eligibleTool(r2, { id: 'mystery', capabilities: [] })).toBe(true);
  });
});
