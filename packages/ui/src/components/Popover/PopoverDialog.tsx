import { forwardRef } from 'react';
import { Dialog as RACDialog, type DialogProps as RACDialogProps } from 'react-aria-components';
import s from './Popover.module.css';

/** Props for {@link PopoverDialog}: React Aria's `Dialog`'s, with a plain `className`. */
export interface PopoverDialogProps extends Omit<RACDialogProps, 'className'> {
  className?: string;
}

/** React Aria's `Dialog` wearing the popover surface: the body of a `<Popover>` that holds a form or a panel. */
export const PopoverDialog = forwardRef<HTMLElement, PopoverDialogProps>(function PopoverDialog({ className, ...props }, ref) {
  return <RACDialog {...props} ref={ref} className={className ? `${s.surface} ${className}` : s.surface} />;
});
