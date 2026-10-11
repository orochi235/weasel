import { describe, it, expect } from 'vitest';
import { reduceBehaviorEnd } from './gestureLifecycle';
import type { BehaviorEnd } from '../gestures/types';

describe('reduceBehaviorEnd', () => {
  it('hands every onEnd the action\'s own end fields beside `answered`', () => {
    interface End extends BehaviorEnd { tag: string }
    const seen: End[] = [];
    const behaviors = [
      { onEnd: (_ctx: null, end: End) => { seen.push(end); return []; } },
      { onEnd: (_ctx: null, end: End) => { seen.push(end); } },
    ];
    reduceBehaviorEnd(behaviors, null, { tag: 'mine' });
    expect(seen).toEqual([{ tag: 'mine', answered: false }, { tag: 'mine', answered: true }]);
  });
});
