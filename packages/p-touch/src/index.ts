/**
 * `@weasel-js/p-touch` — Brother P-touch labels from weasel scenes.
 *
 * - `sceneToLbx` / `writeLbx` write an `.lbx` file P-touch Editor opens, with rects, lines and text
 *   as objects it can edit, and the rest as images.
 * - `renderLabel` draws a label at one pixel per printer dot, and `printLabel` sends it to a printer
 *   over WebUSB or Web Serial through obwat.
 *
 * Scene units are points; a label runs along x for its length and down y across the tape.
 *
 * @packageDocumentation
 */

export { TAPES, tapeForWidthMm, tapeNamed, type Tape } from './tape';
export { labelRenderPlan, printableBand, renderLabel, type LabelGeometry, type RenderLabelArgs } from './render';
export { printLabel, sliceAtCuts, type PrintLabelOptions } from './print';
export { lbxConfig, writeLbx, type LbxPage, type LbxResult, type LbxSkip, type WriteLbxOptions } from './lbx/writeLbx';
export { sceneToLbx, type SceneToLbxArgs } from './lbx/sceneLbx';

// The printer session and the types the functions above take, so a label app needs one import.
export { createBrotherPrinter, NoGrantedDeviceError, Printers } from 'obwat';
export type {
  BrotherPrinter,
  BrotherPrinterOptions,
  DitherAlgorithm,
  DitherOptions,
  MediaSpec,
  PrinterStatus,
  Raster1bpp,
  RgbaImage,
} from 'obwat';
