import type { HarfBuzzModule } from 'harfbuzzjs';

/** Emscripten's factory: instantiates the WebAssembly, found through `locateFile` when given. */
declare function createHarfBuzz(moduleArg?: { locateFile?: (path: string, dir: string) => string }): Promise<HarfBuzzModule>;
export default createHarfBuzz;
