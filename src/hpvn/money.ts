// HPVN money format (as formatGalleons on the site): Vietnamese thousands dots.
// `g` where space is tight (buttons, lists, chips); `galleons` inside sentences. Missing amounts read as 0.
const n = (v: number | undefined) => Math.round(v ?? 0).toLocaleString('vi-VN');
export const g = (v: number | undefined) => `${n(v)} G`;
export const galleons = (v: number | undefined) => `${n(v)} Galleons`;
