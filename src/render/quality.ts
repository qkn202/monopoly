// Phones and small tablets: fewer pixels and no per-building lights. Every PointLight added to the
// scene recompiles every lit material, which stalled phones on each purchase and build.
export const LOW_POWER = typeof window !== 'undefined'
  && (window.matchMedia?.('(pointer: coarse)').matches || (navigator.hardwareConcurrency || 8) <= 4);

/** Camera distance factor that keeps the whole board in view: the width bound (narrow stages) or the height bound (short, wide ones). */
export const viewScale = (aspect: number) => Math.min(2.1, Math.max(1.0, 1.04 / aspect));
