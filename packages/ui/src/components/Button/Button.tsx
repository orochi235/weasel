import { forwardRef, type ButtonHTMLAttributes, type ReactElement, type ReactNode, type Ref } from 'react';
import {
  buttonParts, measureButton, type ButtonFace, type ButtonLayout, type ButtonPart, type ButtonSize,
  type HeadlessComponent,
} from '@weasel-js/ui-logic';
import { nodeText } from '../../nodeText';
import type { DomTarget } from '../../createDomMeasureEnv';
import s from './Button.module.css';
import { ButtonTooltip, type TooltipFields } from '../Tooltip/buttonTooltip';
import type { DisableableProps } from '../Disabled';
import { type AppearanceProps, useAppearance } from '../appearance';
import { useControlSize } from '../ControlSize';
import type { DataAttributes } from '../../nativeProps';

export type { ButtonSize } from '@weasel-js/ui-logic';

/** Visual weight of a button. Defaults to `solid`. `link` drops the
 *  control box entirely and reads as a hyperlink in running text -- for an
 *  in-page navigation that is still a button, not an `<a href>`. The
 *  confirming button is `stance="confirm"` on a `solid` one. */
export type ButtonVariant = 'solid' | 'ghost' | 'link';

/** The `<button>` attributes {@link Button} writes itself, from `pressed`, `loading`, `disabled`, and its
 *  accessible name. */
export type ButtonOwnedAttribute = 'aria-pressed' | 'aria-busy' | 'aria-disabled' | 'aria-label' | 'disabled' | 'children';

/** The native `<button>` attributes and handlers a {@link Button} passes through: every one but those it writes
 *  itself. A handler runs as given; `className` joins the button's own and `style` merges over its appearance. */
export type ButtonDomProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, ButtonOwnedAttribute> & DataAttributes;

/** What every {@link Button} takes. */
export type ButtonBase = ButtonDomProps & {
  variant?: ButtonVariant;
  /** Default: the nearest `ControlSizeScope`'s, else `'md'`. `xs` is a button's alone, for dense chrome such as a
   *  title bar: no scope sets it, so it is given here or not at all. */
  size?: ButtonSize;
  /** A button that stays down: renders `aria-pressed` and holds the active
   *  treatment while it is on. For a control that reports a state rather than
   *  firing an action -- a panel toggle, a mode switch. Left off, the button
   *  announces no pressed state at all, which is what an action button wants. */
  pressed?: boolean;
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  fullWidth?: boolean;
  /** Default `'button'`. */
  type?: 'button' | 'submit' | 'reset';
  children?: ReactNode;
} & AppearanceProps & TooltipFields & DisableableProps;

/** A button with a visible label, which names it. */
export type ButtonRegular = ButtonBase & {
  iconOnly?: false;
  'aria-label'?: string;
};

/** A button showing only its icon, which `aria-label` has to name. */
export type ButtonIconOnly = ButtonBase & {
  iconOnly: true;
  'aria-label': string;
};

/**
 * Props for {@link Button}. Setting `iconOnly` makes `aria-label` required,
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
 * `shortcut` adds a kit tooltip reading `Name (⌘S)`, named by `aria-label` or
 * string children, the way `ActionButton` and `SegmentedBar` items show theirs;
 * `tooltip` replaces that text with any content. A disabled button with a
 * `disabledReason` keeps its tooltip, which reads `Name: reason`.
 *
 * Every other native `<button>` attribute and handler passes through ({@link ButtonDomProps}): `aria-expanded`
 * and `aria-controls` for a disclosure trigger, `tabIndex` and key handlers for a composite widget's roving focus,
 * `form`, `name`, and `value` for a submitter. `ref` forwards to the `<button>`.
 */
export const Button = forwardRef(function Button(
  props: ButtonProps,
  ref: Ref<HTMLButtonElement>,
) {
  const {
    variant = 'solid',
    stance,
    grade,
    emphasis,
    tint,
    pressed,
    disabled,
    loading,
    fullWidth,
    iconOnly,
    'aria-label': ariaLabel,
    type = 'button',
    className,
    style,
    children,
    shortcut,
    tooltip,
    disabledReason,
    size: _size,
    leadingIcon: _leadingIcon,
    trailingIcon: _trailingIcon,
    ...native
  } = props;
  const scoped = useControlSize(props.size === 'xs' ? undefined : props.size);
  const size: ButtonSize = props.size === 'xs' ? 'xs' : scoped;

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

  const face = buttonFaceOf({ ...props, size });
  const appearance = useAppearance({ stance, grade, emphasis, tint });

  return (
    <ButtonTooltip
      tip={{ tooltip, shortcut, ariaLabel, label: children }}
      disabled={disabled}
      disabledReason={disabledReason}
      holdsValue={pressed !== undefined}
    >
      <button
        {...native}
        ref={ref}
        type={type}
        className={cls}
        {...appearance}
        style={appearance.style || style ? { ...appearance.style, ...style } : undefined}
        disabled={disabled}
        aria-busy={loading ? true : undefined}
        aria-pressed={pressed}
        aria-label={ariaLabel}
      >
        {buttonParts(face).map((part) => <ButtonPartSlot key={part} part={part} face={face} label={children} />)}
      </button>
    </ButtonTooltip>
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
 * {@link Button} on the measure/draw contract a HUD button implements too: `measure` is `@weasel-js/ui-logic`'s
 * `measureButton` (pass `createDomMeasureEnv(el)` for any element in the themed root), and `draw` renders the button.
 */
export const domButton: HeadlessComponent<ButtonProps, ButtonLayout, DomTarget<HTMLButtonElement>, ReactElement> = {
  measure: (props, c, env) => measureButton(buttonFaceOf(props), c, env),
  draw: (props, target) => <Button ref={target.ref} {...props} />,
};
