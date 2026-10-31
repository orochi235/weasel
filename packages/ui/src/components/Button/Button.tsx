import { forwardRef, type ButtonHTMLAttributes, type ReactElement, type ReactNode, type Ref } from 'react';
import {
  buttonParts, measureButton, type ButtonFace, type ButtonLayout, type ButtonPart, type ButtonSize as HeadlessButtonSize,
  type HeadlessComponent,
} from '@weasel-js/headless';
import { nodeText } from '../../nodeText';
import type { DomTarget } from '../../domMeasureEnv';
import s from './Button.module.css';
import { SegmentTooltip, segmentTooltipContent, type SegmentTooltipFields } from '../segmentTooltip';
import { type AppearanceProps, useAppearance } from '../appearance';

/** Visual weight of a button. Defaults to `solid`. `link` drops the
 *  control box entirely and reads as a hyperlink in running text -- for an
 *  in-page navigation that is still a button, not an `<a href>`. The
 *  confirming button is `stance="confirm"` on a `solid` one. */
export type ButtonVariant = 'solid' | 'ghost' | 'link';
/** Button height and type scale. */
export type ButtonSize = HeadlessButtonSize;

/** What every {@link Button} takes. */
export type ButtonBase = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** A button that stays down: renders `aria-pressed` and holds the active
   *  treatment while it is on. For a control that reports a state rather than
   *  firing an action -- a panel toggle, a mode switch. Left off, the button
   *  announces no pressed state at all, which is what an action button wants. */
  pressed?: boolean;
  disabled?: boolean;
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  fullWidth?: boolean;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
  style?: ButtonHTMLAttributes<HTMLButtonElement>['style'];
  children?: ReactNode;
  onClick?: ButtonHTMLAttributes<HTMLButtonElement>['onClick'];
  id?: string;
  /** Passed through to the `<button>`, for test ids and consumer hooks. */
  [data: `data-${string}`]: string | undefined;
} & AppearanceProps & SegmentTooltipFields;

/** A button with a visible label, which names it. */
export type ButtonRegular = ButtonBase & {
  iconOnly?: false;
  ariaLabel?: string;
};

/** A button showing only its icon, which `ariaLabel` has to name. */
export type ButtonIconOnly = ButtonBase & {
  iconOnly: true;
  ariaLabel: string;
};

/**
 * Props for {@link Button}. Setting `iconOnly` makes `ariaLabel` required,
 * since an icon-only button has no text for a screen reader to announce.
 */
export type ButtonProps = ButtonRegular | ButtonIconOnly;

function Spinner(): ReactNode {
  return (
    <span className={s.spinner} aria-hidden="true">
      <svg viewBox="0 0 16 16" width="14" height="14">
        <circle
          cx="8"
          cy="8"
          r="6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeOpacity="0.25"
        />
        <path
          d="M 8 2 A 6 6 0 0 1 14 8"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

/**
 * Standard button. `loading` swaps the leading icon for a spinner, marks the
 * button `aria-busy`, and leaves the label in place; it does not disable the
 * button, so pass `disabled` too if the click should be blocked.
 *
 * `shortcut` adds a kit tooltip reading `Name (⌘S)`, named by `ariaLabel` or
 * string children, the way `ToolButton` and `ButtonBar` items show theirs;
 * `tooltip` replaces that text with any content.
 *
 * `ref` forwards to the underlying `<button>`.
 */
export const Button = forwardRef(function Button(
  props: ButtonProps,
  ref: Ref<HTMLButtonElement>,
) {
  const {
    variant = 'solid',
    size = 'md',
    stance,
    grade,
    emphasis,
    tint,
    pressed,
    disabled,
    loading,
    fullWidth,
    iconOnly,
    ariaLabel,
    type = 'button',
    className,
    style,
    children,
    onClick,
    shortcut,
    tooltip,
    id,
  } = props;
  const dataAttrs = Object.fromEntries(Object.entries(props).filter(([k]) => k.startsWith('data-')));

  const cls = [
    s.button,
    s[`variant_${variant}`],
    s[`size_${size}`],
    fullWidth && s.fullWidth,
    pressed && s.pressed,
    iconOnly && s.iconOnly,
    loading && s.loading,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const face = buttonFaceOf(props);
  const appearance = useAppearance({ stance, grade, emphasis, tint });

  return (
    <SegmentTooltip
      content={segmentTooltipContent({ tooltip, shortcut, ariaLabel, label: children })}
      disabled={disabled}
    >
      <button
        ref={ref}
        id={id}
        type={type}
        className={cls}
        {...dataAttrs}
        {...appearance}
        style={appearance.style || style ? { ...appearance.style, ...style } : undefined}
        disabled={disabled}
        aria-busy={loading ? true : undefined}
        aria-pressed={pressed}
        aria-label={ariaLabel}
        onClick={onClick}
      >
        {buttonParts(face).map((part) => <ButtonPartSlot key={part} part={part} face={face} label={children} />)}
      </button>
    </SegmentTooltip>
  );
});

/** What a {@link Button} with `props` shows, as the shared measure reads it: its children are the label, or the
 *  icon when `iconOnly`, and a label that is not text is measured by its text content. */
export function buttonFaceOf(props: ButtonProps): ButtonFace<ReactNode> {
  const { children, size = 'md', iconOnly, loading, leadingIcon, trailingIcon } = props;
  return iconOnly
    ? { size, iconOnly: true, icon: children, loading }
    : { size, label: children === undefined ? undefined : nodeText(children), leadingIcon, trailingIcon, loading };
}

/** One part of a button as the DOM draws it: a slot `Button.module.css` lays out from the tokens `measureButton`
 *  reads. */
function ButtonPartSlot(
  { part, face, label }: { part: ButtonPart; face: ButtonFace<ReactNode>; label: ReactNode },
): ReactNode {
  switch (part) {
    case 'spinner': return face.iconOnly ? <Spinner /> : <span className={s.iconSlot}><Spinner /></span>;
    case 'icon': return <span className={s.iconSlot}>{face.icon}</span>;
    case 'leading': return <span className={s.iconSlot}>{face.leadingIcon}</span>;
    case 'trailing': return <span className={s.iconSlot}>{face.trailingIcon}</span>;
    case 'label': return <span className={s.label}>{label}</span>;
  }
}

/**
 * {@link Button} on the measure/draw contract a HUD button implements too: `measure` is `@weasel-js/headless`'s
 * `measureButton` (pass `domMeasureEnv(el)` for any element in the themed root), and `draw` renders the button.
 */
export const domButton: HeadlessComponent<ButtonProps, ButtonLayout, DomTarget<HTMLButtonElement>, ReactElement> = {
  measure: (props, c, env) => measureButton(buttonFaceOf(props), c, env),
  draw: (props, target) => <Button ref={target.ref} {...props} />,
};
