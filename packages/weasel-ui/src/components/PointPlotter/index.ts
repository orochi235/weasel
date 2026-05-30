export { PointPlotter, type PointPlotterProps } from './PointPlotter';
// `ControlPoint` is the same type used by `CurveEditor`; it's already
// re-exported from `./CurveEditor` at the package root. Re-exporting it
// here would create a duplicate-name collision under `export *`.
