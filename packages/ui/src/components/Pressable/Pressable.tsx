/**
 * Makes an element that is not from React Aria the trigger of an overlay a press opens, such as a
 * `CalloutTrigger`'s, by handing it the trigger's press handlers. The child must forward its ref and DOM props, as
 * the kit `Button` does. `Focusable` does the same for a `TooltipTrigger`.
 */
export { Pressable, type PressableProps } from 'react-aria-components';
