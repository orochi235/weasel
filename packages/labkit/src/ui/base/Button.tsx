import { Button as BaseButton, type ButtonProps as BaseButtonProps } from '@base-ui-components/react/button';
import { cn } from './cn';

export type ButtonVariant = 'default' | 'primary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonProps = Omit<BaseButtonProps, 'className'> & {
  className?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({ variant = 'default', size = 'md', className, ...rest }: ButtonProps) {
  return (
    <BaseButton
      className={cn(
        'lk-button',
        variant !== 'default' && `lk-button--${variant}`,
        size !== 'md' && `lk-button--${size}`,
        className,
      )}
      {...(rest as BaseButtonProps)}
    />
  );
}
