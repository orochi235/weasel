import { describe, it, expect } from 'vitest';
import { lookupShortcutByToolId } from './keybindingsView';

describe('lookupShortcutByToolId', () => {
  it('returns the key spec from the matching entry in tool.activate.defaultBinding', () => {
    const actions = [
      {
        id: 'tool.activate',
        defaultBinding: [
          { spec: { kind: 'key', key: 'r' }, opts: { params: { toolId: 'rect' } } },
          { spec: { kind: 'key', key: 'h' }, opts: { params: { toolId: 'hand' } } },
        ],
      },
    ];
    expect(lookupShortcutByToolId('rect', actions as never)).toEqual({ key: 'r' });
    expect(lookupShortcutByToolId('hand', actions as never)).toEqual({ key: 'h' });
  });

  it('returns undefined when no tool.activate action exists', () => {
    expect(lookupShortcutByToolId('pen', [] as never)).toBeUndefined();
  });

  it('returns undefined when no entry matches the given toolId', () => {
    const actions = [
      {
        id: 'tool.activate',
        defaultBinding: [
          { spec: { kind: 'key', key: 'r' }, opts: { params: { toolId: 'rect' } } },
        ],
      },
    ];
    expect(lookupShortcutByToolId('pen', actions as never)).toBeUndefined();
  });

  it('includes modifier flags when set on the matched entry', () => {
    const actions = [
      {
        id: 'tool.activate',
        defaultBinding: [
          { spec: { kind: 'key', key: 'r', mod: true }, opts: { params: { toolId: 'rect' } } },
        ],
      },
    ];
    expect(lookupShortcutByToolId('rect', actions as never)).toEqual({ key: 'r', mod: true });
  });

  it('returns undefined when the matched entry is not a key spec', () => {
    const actions = [
      {
        id: 'tool.activate',
        defaultBinding: [
          { spec: { kind: 'key-held', key: ' ' }, opts: { params: { toolId: 'weird' } } },
        ],
      },
    ];
    expect(lookupShortcutByToolId('weird', actions as never)).toBeUndefined();
  });
});
