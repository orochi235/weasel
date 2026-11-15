/**
 * Makes an element that is not from React Aria the trigger of an overlay a press opens, such as a
 * `CalloutTrigger`'s, by handing it the trigger's press handlers. The child must forward its ref and DOM props, as
 * the kit `Button` does. `Focusable` does the same for a `TooltipTrigger`.
 */
import type { ComponentProps } from 'react';
import { Pressable } from 'react-aria-components';

export { Pressable };
// react-aria-components re-exports the component but not its props type.
export type PressableProps = ComponentProps<typeof Pressable>;
