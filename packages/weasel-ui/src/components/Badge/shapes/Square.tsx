import type { ShapeModule } from '../types';

export interface SquareParams {
  cornerRadius?: number;
}

const DEFAULTS: Required<SquareParams> = { cornerRadius: 8 };

const Square: ShapeModule<SquareParams> = {
  Component: ({ variant, focused, params }) => {
    const r = Math.max(0, Math.min(params?.cornerRadius ?? DEFAULTS.cornerRadius, 50));
    return (
      <>
        {(variant === 'solid' || variant === 'subtle') && (
          <rect className="badge-fill" x="0" y="0" width="100" height="100" rx={r} ry={r} />
        )}
        {(variant === 'outline' || variant === 'solid') && (
          <rect className="badge-stroke" x="1" y="1" width="98" height="98" rx={Math.max(0, r - 1)} ry={Math.max(0, r - 1)} />
        )}
        {focused && (
          <rect className="badge-focus" x="-3" y="-3" width="106" height="106" rx={r + 3} ry={r + 3} />
        )}
      </>
    );
  },
  insets: { top: 0, right: 0, bottom: 0, left: 0 },
  stretches: true,
  defaults: DEFAULTS,
};

export default Square;
