/**
 * `@weasel-js/editing/test-seams`: what a package's tests stub in editing where jsdom cannot run the real thing,
 * such as measuring a pasted image. Not for app code.
 *
 * @packageDocumentation
 */
export {
  __setImageMeasureForTests, __setFileToDataUriForTests, _resetImageHandlerSeamsForTests,
  type Measure, type ToDataUri,
} from './ingest/imageHandler';
export { __setSvgMeasureForTests, _resetSvgHandlerSeamsForTests } from './ingest/svgHandler';
