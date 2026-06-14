import { describe, it, expect } from 'vitest';
import { eligibleTool, eligibleToolByCapabilities } from './eligibility';
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

  it('untagged tools are ineligible everywhere except modes that allow []', () => {
    expect(eligibleTool(reg, { id: 'mystery' })).toBe(false);
    expect(eligibleTool(reg, { id: 'mystery', capabilities: [] })).toBe(false);
  });

  it('eligibleToolByCapabilities is the pure-arg form', () => {
    expect(eligibleToolByCapabilities(reg.current(), ['edits-anchors'])).toBe(false);
    const r2 = createModeRegistry({ modes: DEFAULT_MODES, initial: 'path-edit' });
    expect(eligibleToolByCapabilities(r2.current(), ['edits-anchors'])).toBe(true);
  });
});
