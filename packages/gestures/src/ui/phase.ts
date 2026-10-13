/** Where a tool stands when a binding is matched: `engaged` while an action it
 *  began is still in flight, `initial` otherwise. The route grammar's `[phase]`
 *  slot draws from this set. */
export type RoutePhase = 'initial' | 'engaged';
