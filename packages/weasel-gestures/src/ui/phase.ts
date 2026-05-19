/** Phase of a gesture lifecycle. `initial` means the tool is idle
 *  (scratch null); `engaged` means a gesture is in progress (scratch
 *  populated). The route-grammar's `[phase]` slot draws from this set. */
export type RoutePhase = 'initial' | 'engaged';
