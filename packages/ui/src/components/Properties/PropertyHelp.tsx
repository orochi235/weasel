import { useEffect, useRef, type MouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useHover } from 'react-aria';
import { useKitSetting } from '@weasel-js/react';
import { Focusable } from '../Tooltip/Focusable';
import { inlineMarkdownText } from '../InlineMarkdown';
import { Tooltip, TooltipTrigger } from '../Tooltip';
import { useRowHelp } from './rowHelp';
import s from './PropertyHelp.module.css';
import row from './Properties.module.css';

/** Props for `<PropertyHelp>`. */
export interface PropertyHelpProps {
  /** What the help is about; a string names the button `About <label>`. */
  label: ReactNode;
  description?: string;
  /** What the setting reads when it is auto; the tooltip's last line, after the word
   *  `auto` drawn as an auto row's readout draws it. */
  autoValue?: ReactNode;
  /**
   * A selector for the ancestor that is the help's row (`'tr'`), with the control the help is about in it.
   * Given, the ⓘ takes no focus, by Tab or by a click: the row's first control outside the ⓘ's own parent is
   * described by the help's text, and the tooltip opens when the keyboard brings focus to a control in the
   * row. Hovering the ⓘ opens it either way.
   */
  within?: string;
  /**
   * The label the help is about, drawn by the help. With `within`, hovering it opens the tooltip and no ⓘ is
   * drawn, unless the kit setting `help.icon` asks for one beside it.
   */
  children?: ReactNode;
}

/** A row label's `description` in a tooltip, shown off the label itself or off an ⓘ beside it. Exported
 *  for surfaces that draw a params label outside a `<PropertyRow>`. With no
 *  `within` it stands alone: a tooltip trigger has to be interactive to be
 *  keyboard-reachable, so it is a real button and a tab stop. */
export function PropertyHelp({ label, description, autoValue, within, children }: PropertyHelpProps) {
  const name = typeof label === 'string' ? label : 'this setting';
  const cue = useRef<HTMLElement | null>(null);
  const help = useRowHelp(cue, within);
  const inRow = within !== undefined;
  const icon = useKitSetting('help.icon') === true;
  const { hoverProps } = useHover({ onHoverChange: help.setOpen });
  const bare = inRow && children != null && !icon;
  const { open, setOpen } = help;
  useEffect(() => {
    if (!bare || !open) return;
    // React Aria dismisses on Escape only for a trigger it holds a ref to, and the label is not one.
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [bare, open, setOpen]);
  const tip = (
    <Tooltip {...(bare ? { triggerRef: cue } : {})}>
      {description}
      {autoValue != null && (
        <span className={description ? `${s.auto} ${s.autoAfter}` : s.auto}>
          <em className={row.autoWord}>auto</em> {autoValue}
        </span>
      )}
    </Tooltip>
  );
  // In the page's body: inside the row it would be part of a <label>'s text, and so of the control's name.
  const text =
    inRow &&
    typeof document !== 'undefined' &&
    createPortal(
      <span id={help.id} hidden>
        {description && inlineMarkdownText(description)}
        {autoValue != null && <> auto {autoValue}</>}
      </span>,
      document.body,
    );
  if (bare) {
    // The label stays in the accessible tree, so the control it names keeps its name; the keyboard reaches the
    // help through the row's control, which the text describes.
    return (
      <TooltipTrigger delay={0} isOpen={help.open} onOpenChange={help.setOpen}>
        <span ref={cue} className={s.label} {...hoverProps}>
          {children}
        </span>
        {text}
        {tip}
      </TooltipTrigger>
    );
  }
  const stop = (e: MouseEvent): void => {
    // The wrapping <label> would otherwise actuate the row's control.
    e.preventDefault();
    e.stopPropagation();
  };
  return (
    <TooltipTrigger delay={0} {...(inRow ? { isOpen: help.open, onOpenChange: help.setOpen } : {})}>
      {children}
      <Focusable excludeFromTabOrder={inRow}>
        {inRow ? (
          // Not a <button>: that is a labelable element, and as the first one in a row's <label> it would be
          // the control the label names, in place of the row's own.
          <span
            ref={cue}
            role="img"
            aria-hidden
            className={s.help}
            onClick={stop}
            onMouseDown={(e) => {
              // A press would otherwise move focus here, off the control the reader was on.
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            ⓘ
          </span>
        ) : (
          <button
            type="button"
            className={s.help}
            aria-label={`About ${name}`}
            onClick={stop}
            onMouseDown={(e) => e.stopPropagation()}
          >
            ⓘ
          </button>
        )}
      </Focusable>
      {text}
      {tip}
    </TooltipTrigger>
  );
}
