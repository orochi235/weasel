/** What `insertLive.gesture` holds while an insert is in flight: the part of
 *  the gesture `insert.adjustRotation` reaches from outside it. */
export interface InsertLiveGesture {
  /** False once the gesture has ended. */
  open: boolean;
  /** Accumulated user-driven rotation (radians) layered on top of any
   *  drag-direction / params rotation. Only consulted for kinds that carry a
   *  `rotation` field on their extras (star / polygon today). */
  userRotation: number;
}
