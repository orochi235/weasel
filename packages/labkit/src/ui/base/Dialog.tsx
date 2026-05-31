import { Dialog as BaseDialog } from '@base-ui-components/react/dialog';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from './cn';

type Override<T> = Omit<T, 'className'> & { className?: string };

function Popup({
  className,
  children,
  ...rest
}: Override<ComponentProps<typeof BaseDialog.Popup>>) {
  return (
    <BaseDialog.Portal>
      <BaseDialog.Backdrop className="lk-dialog-backdrop" />
      <BaseDialog.Popup className={cn('lk-dialog', className)} {...rest}>
        {children}
      </BaseDialog.Popup>
    </BaseDialog.Portal>
  );
}

function Title({ className, ...rest }: Override<ComponentProps<typeof BaseDialog.Title>>) {
  return <BaseDialog.Title className={cn('lk-dialog__title', className)} {...rest} />;
}

function Description({
  className,
  ...rest
}: Override<ComponentProps<typeof BaseDialog.Description>>) {
  return <BaseDialog.Description className={cn('lk-dialog__description', className)} {...rest} />;
}

function Footer({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('lk-dialog__footer', className)}>{children}</div>;
}

export const Dialog = {
  Root: BaseDialog.Root,
  Trigger: BaseDialog.Trigger,
  Close: BaseDialog.Close,
  Popup,
  Title,
  Description,
  Footer,
};
