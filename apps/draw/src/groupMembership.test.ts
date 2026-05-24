import { describe, expect, it } from 'vitest';
import { createGroupAdapter, type GroupsRef } from './groupMembership';

describe('group adapter — single-membership enforcement on create', () => {
  it('insertGroup strips ids that were in a prior group', () => {
    const groupsRef: GroupsRef = { current: [{ id: 'old', members: ['a', 'b', 'c'] }] };
    const adapter = createGroupAdapter(groupsRef);
    adapter.insertGroup({ id: 'new', members: ['a', 'b'] });
    expect(groupsRef.current.find((g) => g.id === 'old')!.members).toEqual(['c']);
    expect(groupsRef.current.find((g) => g.id === 'new')!.members).toEqual(['a', 'b']);
  });

  it('insertGroup strips members from multiple prior groups', () => {
    const groupsRef: GroupsRef = {
      current: [
        { id: 'g1', members: ['a', 'b'] },
        { id: 'g2', members: ['c', 'd'] },
      ],
    };
    const adapter = createGroupAdapter(groupsRef);
    adapter.insertGroup({ id: 'g3', members: ['b', 'c'] });
    expect(groupsRef.current.find((g) => g.id === 'g1')!.members).toEqual(['a']);
    expect(groupsRef.current.find((g) => g.id === 'g2')!.members).toEqual(['d']);
    expect(groupsRef.current.find((g) => g.id === 'g3')!.members).toEqual(['b', 'c']);
  });

  it('addToGroup strips ids that were in a prior group', () => {
    const groupsRef: GroupsRef = {
      current: [
        { id: 'old', members: ['a', 'b'] },
        { id: 'target', members: ['c'] },
      ],
    };
    const adapter = createGroupAdapter(groupsRef);
    adapter.addToGroup('target', ['a']);
    expect(groupsRef.current.find((g) => g.id === 'old')!.members).toEqual(['b']);
    expect(groupsRef.current.find((g) => g.id === 'target')!.members).toEqual(['c', 'a']);
  });

  it('insertGroup leaves untouched groups alone', () => {
    const groupsRef: GroupsRef = {
      current: [
        { id: 'g1', members: ['x', 'y'] },
        { id: 'g2', members: ['z'] },
      ],
    };
    const adapter = createGroupAdapter(groupsRef);
    adapter.insertGroup({ id: 'g3', members: ['x'] });
    expect(groupsRef.current.find((g) => g.id === 'g2')!.members).toEqual(['z']);
  });
});
