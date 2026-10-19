import {
  Children,
  cloneElement,
  forwardRef,
  type ReactElement,
  type Ref,
  useEffect,
  version,
} from 'react';
import { isDev } from '@weasel-js/react';
import type { FocusableElement } from 'react-aria-components';
import {
  type FocusableProps,
  mergeProps,
  mergeRefs,
  useFocusable,
  useObjectRef,
} from 'react-aria';

/** Props for {@link Focusable}: React Aria's, unchanged. */
export type KitFocusableProps = FocusableProps;

const FOCUSABLE = [
  'input:not([disabled]):not([type=hidden])', 'select:not([disabled])', 'textarea:not([disabled])',
  'button:not([disabled])', 'a[href]', 'area[href]', 'summary', '[tabindex]:not([disabled])',
].join(',');

const NATIVE = new Set(['button', 'input', 'select', 'textarea', 'a', 'area', 'summary', 'img', 'svg']);

/** Roles react-aria counts as interactive for a trigger, `img` and the
 *  described ones included. */
const INTERACTIVE_ROLES = new Set([
  'application', 'button', 'checkbox', 'combobox', 'gridcell', 'link', 'menuitem',
  'menuitemcheckbox', 'menuitemradio', 'option', 'radio', 'searchbox', 'separator', 'slider',
  'spinbutton', 'switch', 'tab', 'tabpanel', 'textbox', 'treeitem', 'img', 'meter', 'progressbar',
]);

/** What is wrong with `el` as a trigger, or `null`. Read from its markup
 *  alone: React Aria's own check also asks whether the element is visible, so
 *  a trigger mounted inside a collapsed box warned though it takes focus the
 *  moment the box opens. */
function triggerProblem(el: Element, disabled: boolean): string | null {
  if (!disabled && !el.matches(FOCUSABLE)) {
    return '<Focusable> child must be focusable. Please ensure the tabIndex prop is passed through.';
  }
  if (NATIVE.has(el.localName)) return null;
  const role = el.getAttribute('role');
  if (!role) return '<Focusable> child must have an interactive ARIA role.';
  if (!INTERACTIVE_ROLES.has(role)) return `<Focusable> child must have an interactive ARIA role. Got "${role}".`;
  return null;
}

/**
 * Makes a non-RAC element a `TooltipTrigger` trigger: supplies `tabIndex`, the
 * hover and focus handlers, and `aria-describedby`. The child must forward its
 * ref and DOM props, and carry an interactive role (or `img`).
 */
export const Focusable = forwardRef(function Focusable(
  { children, ...props }: KitFocusableProps,
  forwarded: Ref<FocusableElement>,
): ReactElement {
  const ref = useObjectRef(forwarded);
  const { focusableProps } = useFocusable(props, ref);
  const child = Children.only(children);

  useEffect(() => {
    if (!isDev()) return;
    const el = ref.current;
    if (!el || el.nodeType !== Node.ELEMENT_NODE) {
      console.error('<Focusable> child must forward its ref to a DOM element.');
      return;
    }
    const problem = triggerProblem(el, props.isDisabled === true);
    if (problem) console.warn(problem);
  }, [ref, props.isDisabled]);

  // React 19 moved an element's ref into its props.
  const childRef = (
    Number.parseInt(version, 10) < 19 ? (child as { ref?: unknown }).ref : (child.props as { ref?: unknown }).ref
  ) as Ref<FocusableElement> | undefined;
  return cloneElement(child as ReactElement<Record<string, unknown>>, {
    ...mergeProps(focusableProps, child.props),
    ref: mergeRefs(childRef, ref),
  });
});
