export type RngState = number;

export function fnv1a(input: string): RngState {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  if (h === 0) h = 0x9e3779b9;
  return h >>> 0;
}

export function nextRng(state: RngState): RngState {
  let t = (state + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
  t = (t + Math.imul(t ^ (t >>> 7), t | 61)) >>> 0;
  return t >>> 0;
}

export function draw(state: RngState): [number, RngState] {
  const next = nextRng(state);
  const t = (next ^ (next >>> 14)) >>> 0;
  const value = (t >>> 0) / 4294967296;
  return [value, next];
}

export function drawInt(state: RngState, minInclusive: number, maxExclusive: number): [number, RngState] {
  const [v, ns] = draw(state);
  const range = maxExclusive - minInclusive;
  return [Math.floor(v * range) + minInclusive, ns];
}

export function drawRange(state: RngState, lo: number, hi: number): [number, RngState] {
  const [v, ns] = draw(state);
  return [lo + v * (hi - lo), ns];
}

export function drawChoice<T>(state: RngState, choices: readonly T[]): [T, RngState] {
  const [idx, ns] = drawInt(state, 0, choices.length);
  return [choices[idx], ns];
}
