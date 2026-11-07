/**
 * Chromium flags that put WebGL and WebGPU on one rasterizer and keep a WebGPU
 * device alive through presentation. Why each set: docs/traps/testing.md.
 */

/** A node with a GPU: ANGLE Metal for WebGL, Dawn Metal for WebGPU. */
export const GPU_ARGS = ['--enable-unsafe-webgpu', '--enable-gpu'];

/** GitHub's GPU-less Linux runner: SwiftShader for ANGLE, Vulkan, and the WebGPU adapter. */
export const SWIFTSHADER_ARGS = [
  '--enable-unsafe-webgpu', '--enable-features=Vulkan', '--enable-gpu', '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader', '--use-vulkan=swiftshader', '--use-webgpu-adapter=swiftshader',
];

/** The set for this machine: SwiftShader on Linux, which has no GPU on CI, the GPU elsewhere. */
export const HOST_GPU_ARGS = process.platform === 'linux' ? SWIFTSHADER_ARGS : GPU_ARGS;
