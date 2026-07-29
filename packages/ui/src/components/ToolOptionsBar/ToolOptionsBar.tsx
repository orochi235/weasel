import type { ReactNode } from 'react';
import s from './ToolOptionsBar.module.css';

export interface ToolOptionsBarProps {
  /**
   * Context label for the row — e.g. the active tool's name. Rendered
   * before the children and doubles as the toolbar's `aria-label`. Omit
   * it and the row still renders (it's a permanently reserved slot), just
   * without an accessible name.
   */
  label?: string;
  children?: ReactNode;
  className?: string;
}

/**
 * Horizontal strip reserved above the workspace for contextual tool
 * options — its first tenant is the character controls a text tool
 * exposes while a caret range is active. Pure chrome: it renders an
 * optional label and a children slot, nothing else. It knows nothing
 * about text, or about any specific tool — any tool can fill it.
 *
 * The row always renders, even with no `label` and no `children`,
 * because the app reserves its height permanently rather than mounting
 * it on demand — mounting mid-edit would resize the workspace under a
 * canvas that's sized to the page.
 *
 * `role="toolbar"` without roving tabindex: the ARIA authoring practices
 * expect arrow-key roving focus across a toolbar's items, but this
 * component doesn't own or know the shape of its children — they're
 * arbitrary, possibly compound controls (`NumberField`, `Select`,
 * `ColorField`) that already use arrow keys for their own value editing.
 * Imposing roving focus here would fight those controls' own key
 * handling. Tab order falls back to normal DOM order for now; revisit
 * once the first tenant's control set is concrete and a roving-focus
 * contract can be designed in coordination with those controls.
 */
export function ToolOptionsBar(props: ToolOptionsBarProps) {
  const { label, children, className } = props;
  const cls = [s.root, className].filter(Boolean).join(' ');
  return (
    <div className={cls} role="toolbar" aria-label={label}>
      {label !== undefined && <span className={s.label}>{label}</span>}
      <div className={s.controls}>{children}</div>
    </div>
  );
}
