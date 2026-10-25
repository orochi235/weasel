import type { ReactNode } from 'react';
import { useRovingTabIndex } from '../../useRovingTabIndex';
import s from './Toolbar.module.css';

/** Props for {@link Toolbar}. */
export interface ToolbarProps {
  children: ReactNode;
  /** Names the toolbar for assistive tech. The APG pattern needs one when a view holds more than one. */
  'aria-label'?: string;
  /** Arrow keys move focus between the buttons inside, leaving one in the tab order. Turn it off when
   *  what is inside handles its own arrow keys, as a menu bar does. Default `true`. */
  roving?: boolean;
  /** Lets the controls run onto a second line rather than overflow. */
  wrap?: boolean;
  className?: string;
}

/**
 * A horizontal run of controls: `role="toolbar"`, filled with any controls and
 * with {@link ToolbarGroup}s and {@link ToolbarSpacer}s. It lays them out and
 * draws no strip of its own; the host paints that. Its gap and padding sit in
 * `:where()`, so a host class overrides them.
 */
export function Toolbar({ children, 'aria-label': ariaLabel, roving = true, wrap, className }: ToolbarProps) {
  const { rootRef, onKeyDown } = useRovingTabIndex<HTMLDivElement>({ orientation: 'horizontal' });
  return (
    <div
      ref={roving ? rootRef : undefined}
      className={[s.toolbar, wrap && s.wrap, className].filter(Boolean).join(' ')}
      role="toolbar"
      aria-label={ariaLabel}
      onKeyDown={roving ? onKeyDown : undefined}
    >
      {children}
    </div>
  );
}

/** Props for {@link ToolbarGroup}. */
export interface ToolbarGroupProps {
  children: ReactNode;
  /** Pushes this group, and everything after it, to the far end. */
  end?: boolean;
  'aria-label'?: string;
  className?: string;
}

/** Related controls, kept tight and ruled off from a group beside them. Group rather than separate with
 *  repeated spacers: consecutive spacers share the free space, so every gap collapses to the same slack. */
export function ToolbarGroup({ children, end, 'aria-label': ariaLabel, className }: ToolbarGroupProps) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a group inside role="toolbar" is the APG pattern. <fieldset> means form controls, needs a <legend> to be named, and its UA min-width breaks flex children.
    <div
      className={[s.group, end && s.end, className].filter(Boolean).join(' ')}
      role="group"
      aria-label={ariaLabel}
    >
      {children}
    </div>
  );
}

/** Flexible space that pushes what follows to the far end of the toolbar. */
export function ToolbarSpacer() {
  return <span className={s.spacer} aria-hidden="true" />;
}

/** A ruled-off run of related controls. */
Toolbar.Group = ToolbarGroup;
/** Flexible space that pushes what follows to the far end. */
Toolbar.Spacer = ToolbarSpacer;
