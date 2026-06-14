import type { ReactNode } from 'react';

/**
 * Side-by-side comparison used by row stories to show block + inline layouts
 * at the same time. Not a stories file — name has no .stories. suffix so
 * Storybook's glob skips it.
 */
export function SideBySide({ block, inline }: { block: ReactNode; inline: ReactNode }) {
  const labelStyle = {
    font: '300 0.72rem/1 Oswald, system-ui',
    color: 'var(--lk-text-muted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    margin: '0 0 8px',
  };
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 24,
        width: 720,
        alignItems: 'start',
      }}
    >
      <div>
        <div style={labelStyle}>Block</div>
        {block}
      </div>
      <div>
        <div style={labelStyle}>Inline</div>
        {inline}
      </div>
    </div>
  );
}
