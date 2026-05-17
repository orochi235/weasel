import type { ShapeModule } from '../types';

const d = 'M 0 80 L 0 65 Q 5 40 16 55 Q 22 25 36 48 Q 46 18 56 50 Q 68 22 78 50 Q 88 28 96 55 Q 100 60 100 80 Z';

const Leaves: ShapeModule = {
  Component: ({ variant, focused }) => (
    <>
      {(variant === 'solid' || variant === 'subtle') && <path className="badge-fill" d={d} />}
      {(variant === 'outline' || variant === 'solid') && <path className="badge-stroke" d={d} />}
      {focused && (
        <path className="badge-focus" d={d} transform="translate(50 50) scale(1.05) translate(-50 -50)" />
      )}
    </>
  ),
  insets: { top: 6, right: 4, bottom: 0, left: 4 },
  stretches: true,
};

export default Leaves;
