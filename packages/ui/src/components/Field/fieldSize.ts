import { useControlSizeScope, type ControlSize } from '../ControlSize';
import z from './fieldSize.module.css';

/** `className` with the size class of a field sized `own`, else by its nearest control-size scope; with none when
 *  neither says. */
export function useFieldSizeClass(own: ControlSize | undefined, className?: string): string | undefined {
  const scope = useControlSizeScope();
  const size = own ?? scope;
  return [size && z[size], className].filter(Boolean).join(' ') || undefined;
}
