// The WebGPU backend's WGSL programs and helpers, which no entry exports, for tests.
export { BufferUsage, MapMode, TextureUsage } from '../gpu/webgpu/flags';
export { BATCH_FILL_LOCATIONS, batchFillWgsl } from '../gpu/webgpu/wgsl/batchFill';
export { COMPOSITE_LOCATIONS, COMPOSITE_WGSL } from '../gpu/webgpu/wgsl/composite';
export { assembleCustomWgsl } from '../gpu/webgpu/wgsl/customPrelude';
export { assembleEffectWgsl } from '../gpu/webgpu/wgsl/effectPrelude';
export { BLUR_EFFECT_WGSL } from '../gpu/webgpu/wgsl/effects';
export { GRAD_FILL_LOCATIONS, GRAD_FILL_WGSL } from '../gpu/webgpu/wgsl/gradFill';
export { KIT_WGSL_PROGRAMS, type KitWgslProgram } from '../gpu/webgpu/wgsl/kitPrograms';
export { PATH_FILL_LOCATIONS, PATH_FILL_VCOLOR_WGSL, PATH_FILL_WGSL } from '../gpu/webgpu/wgsl/pathFill';
export { identityNdcGroups } from '../gpu/webgpu/wgsl/testNdc';
export { reflectWgsl } from '../gpu/webgpu/wgslReflect';
export { createUniformBlock, type UniformValue } from '../gpu/webgpu/wgslUniforms';
