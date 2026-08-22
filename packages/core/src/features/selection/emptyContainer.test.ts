import { describe, expect, it } from 'vitest';
import { composeSelectionPose } from './overlay';

type P = { x: number; y: number; width: number; height: number };

const STORED: Record<string, P> = {
  grp: { x: 5, y: 5, width: 50, height: 50 },
  outer: { x: 0, y: 0, width: 99, height: 99 },
  leaf: { x: 10, y: 20, width: 4, height: 6 },
};

function resolver(children: Record<string, string[]>, containers: string[]) {
  return composeSelectionPose<P>({
    getStoredPose: (id) => STORED[id],
    getChildren: (id) => children[id] ?? [],
    isContainer: (id) => containers.includes(id),
  });
}

describe('composeSelectionPose — containers with no leaves', () => {
  it('resolves an empty container to null, not its own stored pose', () => {
    expect(resolver({ grp: [] }, ['grp'])('grp')).toBeNull();
  });

  it('resolves a container holding only empty containers to null', () => {
    expect(resolver({ outer: ['grp'], grp: [] }, ['outer', 'grp'])('outer')).toBeNull();
  });

  it('still unions the real leaves when a container holds both', () => {
    const r = resolver({ outer: ['grp', 'leaf'], grp: [] }, ['outer', 'grp']);
    expect(r('outer')).toEqual({ x: 10, y: 20, width: 4, height: 6 });
  });

  it('leaves a plain leaf untouched', () => {
    expect(resolver({}, [])('leaf')).toEqual(STORED.leaf);
  });
});
