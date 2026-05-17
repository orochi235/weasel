/**
 * Swillustrator App — stub.
 *
 * The pre-purge App.tsx wired the kit's legacy consumer hooks (useDelete /
 * useEscape / useNudge / useGroup / useFlip / useReorder / useClipboard /
 * useDuplicate / useUndoRedo / useNest / useUnnest / useSelectAll) directly
 * onto a custom adapter. Those hooks were deleted in chore/legacy-hook-purge;
 * Swillustrator will be rebuilt against the Actions Registry / dispatcher
 * path (`useStandardActions` + per-action descriptors) in a follow-up.
 *
 * This stub keeps the workspace compiling so the kit's own typecheck and
 * tests stay green.
 */
import type { ReactElement } from 'react';

export function App(): ReactElement {
  return (
    <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1>Swillustrator</h1>
      <p>
        Pending rebuild against the post-purge kit surface. See
        <code> chore/legacy-hook-purge</code>.
      </p>
    </div>
  );
}

export default App;
