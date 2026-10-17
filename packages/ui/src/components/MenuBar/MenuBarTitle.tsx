import type { KeyboardEvent } from 'react';
import { AccessLabel } from '../ContextMenu/AccessLabel';
import s from './MenuBar.module.css';

/** One title of a menu bar: a `menuitem` button that opens its menu. */
export function MenuBarTitle(props: {
  id: string; name: string; access: string | undefined;
  expanded: boolean; disabled: boolean; tabbable: boolean;
  register(el: HTMLButtonElement | null): void;
  onFocus(): void;
  /** A primary-button press on the title. */
  onPress(): void;
  /** The pointer moving onto the title, with the primary button held or not. */
  onEnter(held: boolean): void;
  /** A click no pointer made: assistive technology activating the title. */
  onActivate(): void;
  onKey(e: KeyboardEvent<HTMLButtonElement>): void;
}) {
  return (
    <button
      ref={props.register}
      id={props.id}
      type="button"
      role="menuitem"
      aria-haspopup="menu"
      aria-expanded={props.expanded}
      aria-disabled={props.disabled || undefined}
      tabIndex={props.tabbable ? 0 : -1}
      className={s.title}
      onFocus={props.onFocus}
      // The menu takes focus as it opens; the press must not move it back to the title.
      onMouseDown={(e) => e.preventDefault()}
      onPointerDown={(e) => { if (e.button === 0) props.onPress(); }}
      onPointerEnter={(e) => props.onEnter((e.buttons & 1) === 1)}
      onClick={(e) => { if (e.detail === 0) props.onActivate(); }}
      onKeyDown={props.onKey}
    >
      <AccessLabel label={props.name} access={props.access} />
    </button>
  );
}
