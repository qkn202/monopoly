import { Player, GameState, TileConfig, ColorGroup } from './types';
import { HOGWARTS_TILES } from './boardData';

/**
 * Calculates current rent for a property based on ownership, house count, and monopoly status.
 */
export function calculateRent(
  tile: TileConfig,
  owner: Player,
  diceTotal: number,
  state: GameState
): number {
  if (state.mortgagedProperties[tile.id]) {
    return 0; // Mortgaged properties do not produce rent
  }

  // 1. Station Rent: 75 * 2^(count - 1) -> 75, 150, 300, 600 Galleons
  if (tile.type === 'STATION') {
    const stationsOwned = countStationsOwned(owner, state);
    const baseStationRent = 75 * Math.pow(2, Math.max(0, stationsOwned - 1));
    return baseStationRent * (state.rentMultiplier || 1);
  }

  // 2. Utility Rent: 12x dice if 1 owned, 30x dice if both owned
  if (tile.type === 'UTILITY') {
    const utilsOwned = countUtilitiesOwned(owner, state);
    const multiplier = utilsOwned >= 2 ? 30 : 12;
    const baseUtilRent = Math.max(2, diceTotal) * multiplier;
    return baseUtilRent * (state.rentMultiplier || 1);
  }

  // 3. Regular Street Property
  if (!tile.rentTiers || tile.rentTiers.length === 0) {
    return tile.baseRent || 0;
  }

  let baseRent = tile.baseRent || 0;

  const hotelCount = owner.hotels[tile.id] || 0;
  if (hotelCount > 0) {
    // Hotel / Castle rent is index 5
    baseRent = tile.rentTiers[5] || tile.rentTiers[tile.rentTiers.length - 1];
  } else {
    const houseCount = owner.houses[tile.id] || 0;
    if (houseCount > 0) {
      baseRent = tile.rentTiers[houseCount] || tile.baseRent || 0;
    } else if (tile.colorGroup && ownsFullColorSet(owner, tile.colorGroup, state)) {
      // If unbuilt but owner has full color group: Double Base Rent!
      baseRent = (tile.baseRent || 0) * 2;
    }
  }

  // Apply Global Dark Curse / Escalation Multiplier (e.g. x2)
  const globalMultiplier = state.rentMultiplier || 1;
  return baseRent * globalMultiplier;
}

export function ownsFullColorSet(
  player: Player,
  colorGroup: ColorGroup,
  state: GameState
): boolean {
  const groupTiles = HOGWARTS_TILES.filter(
    (t) => t.type === 'PROPERTY' && t.colorGroup === colorGroup
  );
  if (groupTiles.length === 0) return false;

  return groupTiles.every((t) => state.propertyOwnership[t.id] === player.id);
}

export function countStationsOwned(player: Player, state: GameState): number {
  return HOGWARTS_TILES.filter(
    (t) => t.type === 'STATION' && state.propertyOwnership[t.id] === player.id
  ).length;
}

export function countUtilitiesOwned(player: Player, state: GameState): number {
  return HOGWARTS_TILES.filter(
    (t) => t.type === 'UTILITY' && state.propertyOwnership[t.id] === player.id
  ).length;
}

export function canBuildHouse(
  player: Player,
  propertyId: string,
  state: GameState
): { allowed: boolean; reason?: string } {
  const tile = HOGWARTS_TILES.find((t) => t.id === propertyId);
  if (!tile || tile.type !== 'PROPERTY' || !tile.colorGroup) {
    return { allowed: false, reason: 'Không phải là ô đất có thể xây dựng' };
  }

  if (state.propertyOwnership[tile.id] !== player.id) {
    return { allowed: false, reason: 'Bạn không sở hữu ô đất này' };
  }

  if (!ownsFullColorSet(player, tile.colorGroup, state)) {
    return { allowed: false, reason: 'Bạn cần sở hữu đủ toàn bộ bộ màu này' };
  }

  // Any mortgaged in group blocks building
  const groupTiles = HOGWARTS_TILES.filter((t) => t.colorGroup === tile.colorGroup);
  const anyMortgaged = groupTiles.some((t) => state.mortgagedProperties[t.id]);
  if (anyMortgaged) {
    return { allowed: false, reason: 'Không thể xây dựng khi có bất động sản cùng nhóm đang thế chấp' };
  }

  const currentHouses = player.houses[tile.id] || 0;
  const currentHotels = player.hotels[tile.id] || 0;

  if (currentHotels > 0) {
    return { allowed: false, reason: 'Đã xây dựng Lâu Đài tối đa' };
  }

  if (currentHouses >= 4) {
    return { allowed: false, reason: 'Đã có 4 Túp Lều, cần nâng cấp lên Lâu Đài' };
  }

  const cost = tile.houseCost || 50;
  if (player.balance < cost) {
    return { allowed: false, reason: `Không đủ tiền (Cần ${cost} Galleons)` };
  }

  // Even building rule: Cannot build if current property has more houses than any other in group
  const houseCountsInGroup = groupTiles.map((t) => player.houses[t.id] || 0);
  const minHouses = Math.min(...houseCountsInGroup);
  if (currentHouses > minHouses) {
    return { allowed: false, reason: 'Quy tắc xây đều: Phải xây dựng đồng đều các ô trong nhóm' };
  }

  return { allowed: true };
}

export function canBuildHotel(
  player: Player,
  propertyId: string,
  state: GameState
): { allowed: boolean; reason?: string } {
  const tile = HOGWARTS_TILES.find((t) => t.id === propertyId);
  if (!tile || tile.type !== 'PROPERTY' || !tile.colorGroup) {
    return { allowed: false, reason: 'Không thể xây Lâu Đài' };
  }

  if (state.propertyOwnership[tile.id] !== player.id) {
    return { allowed: false, reason: 'Không sở hữu' };
  }

  const currentHouses = player.houses[tile.id] || 0;
  const currentHotels = player.hotels[tile.id] || 0;

  if (currentHotels > 0) {
    return { allowed: false, reason: 'Đã có Lâu Đài' };
  }

  if (currentHouses < 4) {
    return { allowed: false, reason: 'Cần có đủ 4 Túp Lều trước khi nâng cấp Lâu Đài' };
  }

  const cost = tile.houseCost || 100;
  if (player.balance < cost) {
    return { allowed: false, reason: `Không đủ tiền (Cần ${cost} Galleons)` };
  }

  // Even building rule: All properties in group must have at least 4 houses
  const groupTiles = HOGWARTS_TILES.filter((t) => t.colorGroup === tile.colorGroup);
  const allHave4 = groupTiles.every((t) => (player.houses[t.id] || 0) >= 4 || (player.hotels[t.id] || 0) >= 1);
  if (!allHave4) {
    return { allowed: false, reason: 'Tất cả các ô trong nhóm màu phải đạt 4 Túp Lều trước' };
  }

  return { allowed: true };
}

/**
 * Calculates total Net Worth of a player:
 * Cash + Non-mortgaged properties full price + Mortgaged properties 50% price + Houses/Hotels value
 */
export function calculateNetWorth(player: Player, state: GameState): number {
  if (player.isBankrupt) return 0;

  let netWorth = player.balance;

  player.properties.forEach((tileId) => {
    const tile = HOGWARTS_TILES.find((t) => t.id === tileId);
    if (!tile) return;

    const isMortgaged = !!state.mortgagedProperties[tileId];
    const baseValue = tile.price || 0;

    if (isMortgaged) {
      netWorth += baseValue * 0.5;
    } else {
      netWorth += baseValue;
    }

    const houses = player.houses[tileId] || 0;
    const hotels = player.hotels[tileId] || 0;
    const houseCost = tile.houseCost || 150;

    netWorth += houses * houseCost;
    netWorth += hotels * houseCost * 5;
  });

  return netWorth;
}

export function determineLeaderboard(state: GameState): Player[] {
  return [...state.players].sort((a, b) => {
    if (a.isBankrupt && !b.isBankrupt) return 1;
    if (!a.isBankrupt && b.isBankrupt) return -1;
    return b.netWorth - a.netWorth;
  });
}

/**
 * Calculates Hostile Takeover Cost for landing on another player's property:
 * 2x (Base Price + All Cottages & Castle Construction Values)
 */
export function calculateTakeoverCost(tile: TileConfig, owner: Player): number {
  let assetValue = tile.price || 300;
  const houseCount = owner.houses[tile.id] || 0;
  const hotelCount = owner.hotels[tile.id] || 0;
  const houseCost = tile.houseCost || 150;

  assetValue += houseCount * houseCost;
  assetValue += hotelCount * houseCost * 5;

  return assetValue * 2;
}
