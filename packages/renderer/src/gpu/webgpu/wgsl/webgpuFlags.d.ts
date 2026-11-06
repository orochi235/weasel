// The DOM lib types WebGPU's flag arguments as plain numbers but declares none
// of the flag namespaces themselves.
declare const GPUBufferUsage: {
  readonly MAP_READ: number; readonly MAP_WRITE: number; readonly COPY_SRC: number; readonly COPY_DST: number;
  readonly INDEX: number; readonly VERTEX: number; readonly UNIFORM: number; readonly STORAGE: number;
  readonly INDIRECT: number; readonly QUERY_RESOLVE: number;
};
declare const GPUTextureUsage: {
  readonly COPY_SRC: number; readonly COPY_DST: number; readonly TEXTURE_BINDING: number;
  readonly STORAGE_BINDING: number; readonly RENDER_ATTACHMENT: number;
};
declare const GPUMapMode: { readonly READ: number; readonly WRITE: number };
declare const GPUShaderStage: { readonly VERTEX: number; readonly FRAGMENT: number; readonly COMPUTE: number };
declare const GPUColorWrite: {
  readonly RED: number; readonly GREEN: number; readonly BLUE: number; readonly ALPHA: number; readonly ALL: number;
};
