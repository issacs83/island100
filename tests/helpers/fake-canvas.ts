// A stand-in for document.createElement('canvas') so canvas-texture code can run under node: every 2D context call
// is a no-op, gradients accept colour stops. Import this before modules that draw textures.
const context = new Proxy({}, {
  get: (_t, key) => key === 'createLinearGradient' || key === 'createRadialGradient' ? () => ({addColorStop() {}}) : () => {},
  set: () => true,
});
(globalThis as {document?: unknown}).document ??= {createElement: () => ({width: 0, height: 0, style: {}, getContext: () => context})};
export {};
