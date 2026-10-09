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
 * All cards sit flush edge-to-edge with zero gaps (sát cạnh nhau, không lộ khoảng cách đen).
 */
export function getCardCoord(index: number): CardCoord {
  const idx = ((index % 40) + 40) % 40;
  const isCorner = idx === 0 || idx === 10 || idx === 20 || idx === 30;
  const z = 0.025;

  let x = 0;
  let y = 0;
  let width = CARD_SHORT;
  let height = CARD_LONG;
  let orientation: CardOrientation = 'VERTICAL';

  if (idx === 0) {
    // Corner 0: Platform 9 3/4 (Bottom Right)
    x = CORNER_CENTER;
    y = -CORNER_CENTER;
    width = CORNER_SIZE;
    height = CORNER_SIZE;
    orientation = 'CORNER';
  } else if (idx < 10) {
    // South side: right to left (1..9) - Vertical Cards touching flush
    x = INNER_CORNER_EDGE - (idx - 0.5) * SLOT_WIDTH;
    y = -CORNER_CENTER;
    width = CARD_SHORT;
    height = CARD_LONG;
    orientation = 'VERTICAL';
  } else if (idx === 10) {
    // Corner 10: Azkaban (Bottom Left)
    x = -CORNER_CENTER;
    y = -CORNER_CENTER;
    width = CORNER_SIZE;
    height = CORNER_SIZE;
    orientation = 'CORNER';
  } else if (idx < 20) {
    // West side: bottom to top (11..19) - Horizontal Cards touching flush
    const k = idx - 10;
    x = -CORNER_CENTER;
    y = -INNER_CORNER_EDGE + (k - 0.5) * SLOT_WIDTH;
    width = CARD_LONG;
    height = CARD_SHORT;
    orientation = 'HORIZONTAL';
  } else if (idx === 20) {
    // Corner 20: Room of Requirement (Top Left)
    x = -CORNER_CENTER;
    y = CORNER_CENTER;
    width = CORNER_SIZE;
    height = CORNER_SIZE;
    orientation = 'CORNER';
  } else if (idx < 30) {
    // North side: left to right (21..29) - Vertical Cards touching flush
    const k = idx - 20;
    x = -INNER_CORNER_EDGE + (k - 0.5) * SLOT_WIDTH;
    y = CORNER_CENTER;
    width = CARD_SHORT;
    height = CARD_LONG;
    orientation = 'VERTICAL';
  } else if (idx === 30) {
    // Corner 30: Go to Azkaban (Top Right)
    x = CORNER_CENTER;
    y = CORNER_CENTER;
    width = CORNER_SIZE;
    height = CORNER_SIZE;
    orientation = 'CORNER';
  } else {
    // East side: top to bottom (31..39) - Horizontal Cards touching flush
    const k = idx - 30;
    x = CORNER_CENTER;
    y = INNER_CORNER_EDGE - (k - 0.5) * SLOT_WIDTH;
    width = CARD_LONG;
    height = CARD_SHORT;
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
export function getTileTokenPosition(tileIndex: number, playerIndex: number = 0, totalOnTile: number = 1): THREE.Vector3 {
  const coord = getCardCoord(tileIndex);
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
export function getCardBuildingBasePos(tileIndex: number): { x: number; y: number; rotZ: number } {
  const coord = getCardCoord(tileIndex);
  let x = coord.x;
  let y = coord.y;
  const offset = 0.50;

  const idx = ((tileIndex % 40) + 40) % 40;
  if (idx < 10) {
    y += offset;
  } else if (idx < 20) {
    x += offset;
  } else if (idx < 30) {
    y -= offset;
  } else {
    x -= offset;
  }

  return { x, y, rotZ: 0 };
}
