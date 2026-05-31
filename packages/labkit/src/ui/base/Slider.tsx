import { Slider as BaseSlider } from '@base-ui-components/react/slider';
import type { ComponentProps } from 'react';
import { cn } from './cn';

type Override<T> = Omit<T, 'className'> & { className?: string };

export function Slider({ className, ...rest }: Override<ComponentProps<typeof BaseSlider.Root>>) {
  return (
    <BaseSlider.Root className={cn('lk-slider', className)} {...rest}>
      <BaseSlider.Control className="lk-slider__control">
        <BaseSlider.Track className="lk-slider__track">
          <BaseSlider.Indicator className="lk-slider__indicator" />
          <BaseSlider.Thumb className="lk-slider__thumb" />
        </BaseSlider.Track>
      </BaseSlider.Control>
    </BaseSlider.Root>
  );
}
