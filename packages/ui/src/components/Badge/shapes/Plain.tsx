import type { ShapeModule } from '../types';

const Plain: ShapeModule = {
  Component: () => null,
  insets: { top: 0, right: 0, bottom: 0, left: 0 },
  stretches: true,
  renderMode: 'css',
};

export default Plain;
