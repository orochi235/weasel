/**
 * RotatedResizeMathDemo — stubbed.
 *
 * The pre-purge demo wired four parallel `useResize` controllers and a
 * pile of bespoke pose descriptors to compare resize-math variants on a
 * rotated rect. Phase 14e Task 4 deleted the standalone `useResize` hook
 * in favor of the dispatcher-side `resizeAction` + `resizePolicy` dep, so
 * the four-up controller-array UI no longer has a direct API to bind to.
 *
 * This stub keeps the demo registry compiling. A rebuild against the
 * dispatcher path would need to mount four `<SceneCanvas>` instances with
 * different `resizePolicy` projections; that's a follow-up.
 */
import type { ReactElement } from 'react';

export function RotatedResizeMathDemo(): ReactElement {
  return (
    <div className="ckd-stub">
      <h2>RotatedResizeMathDemo</h2>
      <p>
        Pending rebuild against the post-purge dispatcher path
        (<code>resizeAction</code> + <code>resizePolicy</code> dep).
      </p>
    </div>
  );
}

export default RotatedResizeMathDemo;
