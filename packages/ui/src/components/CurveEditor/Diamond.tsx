import type { ReactElement, SVGProps } from 'react';

/** Props for {@link Diamond}: its center, half its side, and anything else a `<rect>` takes. */
export type DiamondProps = { at: { x: number; y: number }; half: number } & Omit<SVGProps<SVGRectElement>, 'x' | 'y' | 'width' | 'height' | 'transform'>;

/** A square handle turned 45° about its center `at`. */
export function Diamond({ at, half, ...rest }: DiamondProps): ReactElement {
  return <rect {...rest} x={at.x - half} y={at.y - half} width={half * 2} height={half * 2} transform={`rotate(45 ${at.x} ${at.y})`} />;
}
