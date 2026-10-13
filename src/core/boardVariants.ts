import { TileConfig } from './types';
import { HOGWARTS_TILES } from './boardData';

/**
 * Resolves the canonical artwork asset index (0..39) corresponding to
 * `public/assets/cards/tile_${assetId}.webp`.
 *
 * For example:
 * - { id: 'tile-0' } -> 0 (Ga 9¾)
 * - { id: 'tile-10' } -> 10 (Nhà Tù Azkaban)
 * - { id: 'tile-20' } -> 20 (Phòng Yêu Cầu)
 * - { id: 'tile-30' } -> 30 (Áp Giải Đến Azkaban)
 * - { id: 'tile-39' } -> 39 (Văn Phòng Cụ Dumbledore)
 */
export function getTileAssetId(tile: { id?: string; index?: number } | null | undefined): number {
  if (!tile) return 0;
  if (tile.id && tile.id.startsWith('tile-')) {
    const parsed = parseInt(tile.id.replace('tile-', ''), 10);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 39) {
      return parsed;
    }
  }
  return tile.index ?? 0;
}

/**
 * Create a variant board configuration by pulling canonical tile data from HOGWARTS_TILES.
 * This guarantees:
 * 1. 100% accurate location names, icons, descriptions, prices, and rent tiers matching the master board.
 * 2. 100% accurate artwork image mapping (tile_${assetId}.webp where assetId matches canonical tile.id).
 * 3. Board slot index is properly set from 0 to size - 1.
 */
function createVariantBoard(tileIds: string[]): TileConfig[] {
  return tileIds.map((id, index) => {
    const canonical = HOGWARTS_TILES.find((t) => t.id === id);
    if (!canonical) {
      throw new Error(`Canonical tile not found for ID: ${id}`);
    }
    return {
      ...canonical,
      index, // re-index to the position on this variant board
    };
  });
}

/**
 * 28-TILE BOARD CONFIGURATION (Rút Gọn / 3 Người Chơi)
 * - 4 góc kinh điển:
 *   - 0: Ga 9¾ (GO)
 *   - 7: Ngục Azkaban (JAIL)
 *   - 14: Phòng Yêu Cầu (FREE PARKING)
 *   - 21: Áp Giải Đến Azkaban (GO TO JAIL)
 * - 16 ô đất mua được (8 bộ màu đôi 2-ô hoàn chỉnh: BROWN, LIGHT_BLUE, PINK, ORANGE, RED, YELLOW, GREEN, DARK_BLUE)
 * - 3 nhà ga (Tàu Tốc Hành, Trạm Xe Buýt Hiệp Sĩ, Bến Cỗ Xe Vọng Mã)
 * - 1 ô thuế (Thuế Thẩm Định Pháp Thuật)
 * - 4 ô thẻ bài (2 Potions + 2 Charms)
 */
export const BOARD_28_TILE_IDS: string[] = [
  // South (Góc 0 đến Góc 7) - 7 ô
  'tile-0',  // 0: Ga 9¾ (Khởi Hành) - GO
  'tile-1',  // 1: Borgin & Burkes - BROWN
  'tile-3',  // 2: Quán Cái Vạc Lủng - BROWN
  'tile-2',  // 3: Hộp Độc Dược - POTIONS
  'tile-6',  // 4: Tiệm Cú Eeylops - LIGHT_BLUE
  'tile-9',  // 5: Tiệm Đũa Phép Ollivanders - LIGHT_BLUE
  'tile-5',  // 6: Tàu Tốc Hành Hogwarts - STATION

  // West (Góc 7 đến Góc 14) - 7 ô
  'tile-10', // 7: Nhà Tù Azkaban (Thăm Nuôi) - JAIL
  'tile-11', // 8: Quán Ba Cây Chổi - PINK
  'tile-13', // 9: Tiệm Kẹo Công Tước Mật - PINK
  'tile-7',  // 10: Hộp Bùa Chú - CHARMS
  'tile-18', // 11: Nhà Gia Đình Potter - ORANGE
  'tile-19', // 12: Nhà Cụ Bathilda Bagshot - ORANGE
  'tile-15', // 13: Trạm Xe Buýt Hiệp Sĩ - STATION

  // North (Góc 14 đến Góc 21) - 7 ô
  'tile-20', // 14: Phòng Yêu Cầu (Kho Báu) - FREE_PARKING
  'tile-21', // 15: Tổ Nhện Khổng Lồ Aragog - RED
  'tile-24', // 16: Cây Liễu Roi - RED
  'tile-17', // 17: Hộp Độc Dược - POTIONS
  'tile-26', // 18: Đại Sảnh Đường Hogwarts - YELLOW
  'tile-27', // 19: Tháp Thiên Văn - YELLOW
  'tile-25', // 20: Bến Cỗ Xe Vọng Mã - STATION

  // East (Góc 21 đến 27) - 7 ô
  'tile-30', // 21: Áp Giải Đến Azkaban - GO_TO_JAIL
  'tile-31', // 22: Phòng Bí Mật (Sở Ban Ngành) - GREEN
  'tile-34', // 23: Sảnh Trung Tâm Bộ Pháp Thuật - GREEN
  'tile-4',  // 24: Thuế Thẩm Định Pháp Thuật - TAX
  'tile-37', // 25: Hầm 713 Ngân Hàng Gringotts - DARK_BLUE
  'tile-39', // 26: Văn Phòng Cụ Dumbledore - DARK_BLUE
  'tile-36', // 27: Hộp Bùa Chú - CHARMS
];

export const HOGWARTS_TILES_28: TileConfig[] = createVariantBoard(BOARD_28_TILE_IDS);

/**
 * 20-TILE BOARD CONFIGURATION (Mini / 1v1 Siêu Tốc 2 Người Chơi)
 * - 4 góc kinh điển:
 *   - 0: Ga 9¾ (GO)
 *   - 5: Ngục Azkaban (JAIL)
 *   - 10: Phòng Yêu Cầu (FREE PARKING)
 *   - 15: Áp Giải Đến Azkaban (GO TO JAIL)
 * - 14 ô đất mua được (7 bộ màu đôi 2-ô liền kề):
 *   - BROWN: Borgin & Burkes, Quán Cái Vạc Lủng
 *   - LIGHT_BLUE: Tiệm Cú Eeylops, Tiệm Đũa Phép Ollivanders
 *   - PINK: Quán Ba Cây Chổi, Tiệm Kẹo Công Tước Mật
 *   - ORANGE: Nhà Gia Đình Potter, Nhà Cụ Bathilda Bagshot
 *   - RED: Tổ Nhện Khổng Lồ Aragog, Cây Liễu Roi
 *   - YELLOW: Đại Sảnh Đường Hogwarts, Tháp Thiên Văn
 *   - DARK_BLUE: Hầm 713 Ngân Hàng Gringotts, Văn Phòng Cụ Dumbledore
 * - 2 ô thẻ bài bí ẩn (1 Potions + 1 Charms)
 */
export const BOARD_20_TILE_IDS: string[] = [
  // South (Góc 0 đến Góc 5) - 5 ô
  'tile-0',  // 0: Ga 9¾ (Khởi Hành) - GO
  'tile-1',  // 1: Borgin & Burkes - BROWN
  'tile-3',  // 2: Quán Cái Vạc Lủng - BROWN
  'tile-2',  // 3: Hộp Độc Dược - POTIONS
  'tile-6',  // 4: Tiệm Cú Eeylops - LIGHT_BLUE

  // West (Góc 5 đến Góc 10) - 5 ô
  'tile-10', // 5: Nhà Tù Azkaban (Thăm Nuôi) - JAIL
  'tile-9',  // 6: Tiệm Đũa Phép Ollivanders - LIGHT_BLUE
  'tile-11', // 7: Quán Ba Cây Chổi - PINK
  'tile-13', // 8: Tiệm Kẹo Công Tước Mật - PINK
  'tile-7',  // 9: Hộp Bùa Chú - CHARMS

  // North (Góc 10 đến Góc 15) - 5 ô
  'tile-20', // 10: Phòng Yêu Cầu (Kho Báu) - FREE_PARKING
  'tile-18', // 11: Nhà Gia Đình Potter - ORANGE
  'tile-19', // 12: Nhà Cụ Bathilda Bagshot - ORANGE
  'tile-21', // 13: Tổ Nhện Khổng Lồ Aragog - RED
  'tile-24', // 14: Cây Liễu Roi - RED

  // East (Góc 15 đến 19) - 5 ô
  'tile-30', // 15: Áp Giải Đến Azkaban - GO_TO_JAIL
  'tile-26', // 16: Đại Sảnh Đường Hogwarts - YELLOW
  'tile-27', // 17: Tháp Thiên Văn - YELLOW
  'tile-37', // 18: Hầm 713 Ngân Hàng Gringotts - DARK_BLUE
  'tile-39', // 19: Văn Phòng Cụ Dumbledore - DARK_BLUE
];

export const HOGWARTS_TILES_20: TileConfig[] = createVariantBoard(BOARD_20_TILE_IDS);

/**
 * Returns the active tiles for a given board size (20, 28, or default 40)
 */
export function getBoardTiles(size: number = 40): TileConfig[] {
  if (size === 20) return HOGWARTS_TILES_20;
  if (size === 28) return HOGWARTS_TILES_28;
  return HOGWARTS_TILES;
}
