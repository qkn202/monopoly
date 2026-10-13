import * as THREE from 'three';

export type CardOrientation = 'VERTICAL' | 'HORIZONTAL' | 'CORNER';

export interface CardCoord {
  index: number;
  x: number;
  y: number;
  z: number;
  rotZ: number;
  width: number;
  height: number;
  orientation: CardOrientation;
  isCorner: boolean;
}

// Exact mathematical geometry for seamless, zero-gap flush cards:
// Track inner edge = 3.96, outer edge = 5.54
// Track span = 7.92 -> 9 slots * 0.88 = 7.92 EXACTLY!
export const CORNER_SIZE = 1.58;
export const CARD_SHORT = 0.88; // Card width on top/bottom, card height on left/right
export const CARD_LONG = 1.58;  // Card height on top/bottom, card width on left/right
export const CORNER_CENTER = 4.75;
export const INNER_CORNER_EDGE = 3.96; // 4.75 - 1.58 / 2 = 3.96
export const TRACK_SPAN = 7.92; // 3.96 * 2
export const SLOT_WIDTH = 0.88; // Exactly equal to CARD_SHORT (7.92 / 9 = 0.88)

/**
 * Returns the exact card transformation on the 3D board.
 * Works seamlessly for 20-tile, 28-tile, and 40-tile square boards.
 * All cards sit flush edge-to-edge with zero gaps (sát cạnh nhau, không lộ khoảng cách đen).
 */
export function getCardCoord(index: number, totalTiles: number = 40): CardCoord {
  const N = totalTiles || 40;
  const idx = ((index % N) + N) % N;
  const S = (N - 4) / 4; // Intermediate slots per side: 4 for 20-tile, 6 for 28-tile, 9 for 40-tile
  const slotWidth = TRACK_SPAN / S; // Exactly fills the track span without gap

  const c0 = 0;
  const c1 = 1 + S;
  const c2 = 2 * (1 + S);
  const c3 = 3 * (1 + S);

  const isCorner = idx === c0 || idx === c1 || idx === c2 || idx === c3;
  const z = 0.025;

  let x = 0;
  let y = 0;
  let width = slotWidth;
  let height = CARD_LONG;
  let orientation: CardOrientation = 'VERTICAL';

  if (idx === c0) {
    // Corner 0: Platform 9 3/4 (Bottom Right)
    x = CORNER_CENTER;
    y = -CORNER_CENTER;
    width = CORNER_SIZE;
    height = CORNER_SIZE;
    orientation = 'CORNER';
  } else if (idx < c1) {
    // South side: right to left (1..S) - Vertical Cards touching flush
    x = INNER_CORNER_EDGE - (idx - 0.5) * slotWidth;
    y = -CORNER_CENTER;
    width = slotWidth;
    height = CARD_LONG;
    orientation = 'VERTICAL';
  } else if (idx === c1) {
    // Corner 1: Azkaban (Bottom Left)
    x = -CORNER_CENTER;
    y = -CORNER_CENTER;
    width = CORNER_SIZE;
    height = CORNER_SIZE;
    orientation = 'CORNER';
  } else if (idx < c2) {
    // West side: bottom to top (c1+1..c2-1) - Horizontal Cards touching flush
    const k = idx - c1;
    x = -CORNER_CENTER;
    y = -INNER_CORNER_EDGE + (k - 0.5) * slotWidth;
    width = CARD_LONG;
    height = slotWidth;
    orientation = 'HORIZONTAL';
  } else if (idx === c2) {
    // Corner 2: Room of Requirement (Top Left)
    x = -CORNER_CENTER;
    y = CORNER_CENTER;
    width = CORNER_SIZE;
    height = CORNER_SIZE;
    orientation = 'CORNER';
  } else if (idx < c3) {
    // North side: left to right (c2+1..c3-1) - Vertical Cards touching flush
    const k = idx - c2;
    x = -INNER_CORNER_EDGE + (k - 0.5) * slotWidth;
    y = CORNER_CENTER;
    width = slotWidth;
    height = CARD_LONG;
    orientation = 'VERTICAL';
  } else if (idx === c3) {
    // Corner 3: Go to Azkaban (Top Right)
    x = CORNER_CENTER;
    y = CORNER_CENTER;
    width = CORNER_SIZE;
    height = CORNER_SIZE;
    orientation = 'CORNER';
  } else {
    // East side: top to bottom (c3+1..N-1) - Horizontal Cards touching flush
    const k = idx - c3;
    x = CORNER_CENTER;
    y = INNER_CORNER_EDGE - (k - 0.5) * slotWidth;
    width = CARD_LONG;
    height = slotWidth;
    orientation = 'HORIZONTAL';
  }

  return {
    index: idx,
    x,
    y,
    z,
    rotZ: 0,
    width,
    height,
    orientation,
    isCorner,
  };
}

/**
 * Calculates 3D world coordinates for player tokens (standing at card center)
 */
export function getTileTokenPosition(
  tileIndex: number,
  playerIndex: number = 0,
  totalOnTile: number = 1,
  totalTiles: number = 40
): THREE.Vector3 {
  const coord = getCardCoord(tileIndex, totalTiles);
  let x = coord.x;
  let y = coord.y;
  const z = 0.22;

  // Radial dispersion if multiple players share the tile
  if (totalOnTile > 1) {
    const angle = (playerIndex / totalOnTile) * Math.PI * 2;
    const r = coord.isCorner ? 0.35 : 0.22;
    x += Math.cos(angle) * r;
    y += Math.sin(angle) * r;
  }

  return new THREE.Vector3(x, y, z);
}

/**
 * Calculates position for cottages/castles on the inner edge of a card
 */
export function getCardBuildingBasePos(
  tileIndex: number,
  totalTiles: number = 40
): { x: number; y: number; rotZ: number } {
  const coord = getCardCoord(tileIndex, totalTiles);
  let x = coord.x;
  let y = coord.y;
  const offset = 0.50;

  const N = totalTiles || 40;
  const idx = ((tileIndex % N) + N) % N;
  const S = (N - 4) / 4;
  const c1 = 1 + S;
  const c2 = 2 * (1 + S);
  const c3 = 3 * (1 + S);

  if (idx < c1) {
    y += offset;
  } else if (idx < c2) {
    x += offset;
  } else if (idx < c3) {
    y -= offset;
  } else {
    x -= offset;
  }

  return { x, y, rotZ: 0 };
}
