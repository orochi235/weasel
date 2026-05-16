import type { ShapeModule } from '../types';

const d = 'M 0 50 L 12 0 L 88 0 L 100 50 L 88 100 L 12 100 Z';

const Banner: ShapeModule = {
  Component: ({ variant, focused }) => (
    <>
      {(variant === 'solid' || variant === 'subtle') && <path className="badge-fill" d={d} />}
      {(variant === 'outline' || variant === 'solid') && <path className="badge-stroke" d={d} />}
      {focused && <path className="badge-focus" d="M -4 50 L 11 -3 L 89 -3 L 104 50 L 89 103 L 11 103 Z" />}
    </>
  ),
  insets: { top: 0, right: 10, bottom: 0, left: 10 },
  stretches: true,
};

export default Banner;
