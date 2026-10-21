import { useDepSource } from '@weasel-js/routing/react';
import type { TransformFollower } from 'interactions/actions/transformFinish';

/**
 * Add a follower to the `transformFollowers` dep for the lifetime of the
 * calling component, after every one already there in its scope and the
 * scopes above. `follower` is read each time the dep is; answering null adds
 * nothing.
 */
export function useTransformFollower(follower: () => TransformFollower | null): void {
  useDepSource('transformFollowers', (below) => {
    const under = below() ?? [];
    const mine = follower();
    return mine === null ? under : [...under, mine];
  });
}
