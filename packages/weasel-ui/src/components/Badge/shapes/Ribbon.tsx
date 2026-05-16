import type { ShapeModule } from '../types';

const d = 'M 0 0 L 88 0 L 100 50 L 88 100 L 0 100 L 12 50 Z';

const Ribbon: ShapeModule = {
  Component: ({ variant, focused }) => (
    <>
      {(variant === 'solid' || variant === 'subtle') && <path className="badge-fill" d={d} />}
      {(variant === 'outline' || variant === 'solid') && <path className="badge-stroke" d={d} />}
      {focused && (
        <path
          className="badge-focus"
          d={d}
          transform="translate(50 50) scale(1.06) translate(-50 -50)"
        />
      )}
    </>
  ),
  insets: { top: 0, right: 10, bottom: 0, left: 12 },
  stretches: true,
};

export default Ribbon;
