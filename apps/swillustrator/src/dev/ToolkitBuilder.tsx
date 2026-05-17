/**
 * Toolkit Builder — stub.
 *
 * The pre-purge ToolkitBuilder wired every legacy consumer hook (useDelete /
 * useEscape / useNudge / ... / useNest / useUnnest) onto a custom adapter to
 * let developers toggle each interaction on/off. Those hooks are gone (see
 * `chore/legacy-hook-purge`); this stub keeps the workspace compiling until
 * Swillustrator is rebuilt against the dispatcher / Actions Registry path.
 */
import type { ReactElement } from 'react';

export function ToolkitBuilder(): ReactElement {
  return (
    <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1>Toolkit Builder</h1>
      <p>Pending rebuild against the post-purge kit surface.</p>
    </div>
  );
}

export default ToolkitBuilder;
