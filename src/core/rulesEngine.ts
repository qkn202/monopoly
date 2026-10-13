import { Player, GameState, TileConfig, ColorGroup } from './types';
import { HOGWARTS_TILES } from './boardData';
import { galleons } from '../hpvn/money';

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
  const tiles = state.boardTiles || HOGWARTS_TILES;
  const groupTiles = tiles.filter(
    (t) => t.type === 'PROPERTY' && t.colorGroup === colorGroup
  );
  if (groupTiles.length === 0) return false;

  return groupTiles.every((t) => state.propertyOwnership[t.id] === player.id);
}

export function countStationsOwned(player: Player, state: GameState): number {
  const tiles = state.boardTiles || HOGWARTS_TILES;
  return tiles.filter(
    (t) => t.type === 'STATION' && state.propertyOwnership[t.id] === player.id
  ).length;
}

export function countUtilitiesOwned(player: Player, state: GameState): number {
  const tiles = state.boardTiles || HOGWARTS_TILES;
  return tiles.filter(
    (t) => t.type === 'UTILITY' && state.propertyOwnership[t.id] === player.id
  ).length;
}

export function canBuildHouse(
  player: Player,
  propertyId: string,
  state: GameState
): { allowed: boolean; reason?: string } {
  const tiles = state.boardTiles || HOGWARTS_TILES;
  const tile = tiles.find((t) => t.id === propertyId);
  if (!tile || tile.type !== 'PROPERTY' || !tile.houseCost) {
    return { allowed: false, reason: 'Không phải là ô đất có thể xây dựng' };
  }

  if (state.propertyOwnership[tile.id] !== player.id) {
    return { allowed: false, reason: 'Bạn không sở hữu ô đất này' };
  }

  if (state.mortgagedProperties[tile.id]) {
    return { allowed: false, reason: 'Ô đất này đang bị thế chấp, cần chuộc lại trước' };
  }

  const currentHotels = player.hotels[tile.id] || 0;
  if (currentHotels > 0) {
    return { allowed: false, reason: 'Đã xây dựng Lâu Đài tối đa' };
  }

  const currentHouses = player.houses[tile.id] || 0;
  if (currentHouses >= 4) {
    return { allowed: false, reason: 'Đã có 4 Túp Lều, cần nâng cấp lên Lâu Đài' };
  }

  // RULE: Can only upgrade WHERE the player is currently standing
  const currentTile = tiles[player.position];
  if (!currentTile || currentTile.id !== propertyId) {
    return { allowed: false, reason: 'Chỉ được nâng cấp mảnh đất nơi bạn đang đặt chân đến' };
  }

  // RULE: Must land on this property in a subsequent turn (visit 2+) to build/upgrade
  if (!player.visitedProperties.includes(propertyId)) {
    return { allowed: false, reason: 'Chỉ được nâng cấp khi đặt chân vào ô đất này từ lần 2 (mỗi lần ghé thăm được nâng cấp 1 lần)' };
  }

  const cost = tile.houseCost;
  if (player.balance < cost) {
    return { allowed: false, reason: `Không đủ tiền (Cần ${galleons(cost)})` };
  }

  return { allowed: true };
}

export function canBuildHotel(
  player: Player,
  propertyId: string,
  state: GameState
): { allowed: boolean; reason?: string } {
  const tiles = state.boardTiles || HOGWARTS_TILES;
  const tile = tiles.find((t) => t.id === propertyId);
  if (!tile || tile.type !== 'PROPERTY' || !tile.houseCost) {
    return { allowed: false, reason: 'Không thể xây Lâu Đài' };
  }

  if (state.propertyOwnership[tile.id] !== player.id) {
    return { allowed: false, reason: 'Bạn không sở hữu ô đất này' };
  }

  if (state.mortgagedProperties[tile.id]) {
    return { allowed: false, reason: 'Ô đất này đang bị thế chấp, cần chuộc lại trước' };
  }

  const currentHotels = player.hotels[tile.id] || 0;
  if (currentHotels > 0) {
    return { allowed: false, reason: 'Đã có Lâu Đài tối đa' };
  }

  const currentHouses = player.houses[tile.id] || 0;
  if (currentHouses < 4) {
    return { allowed: false, reason: 'Cần có đủ 4 Túp Lều trước khi nâng cấp lên Lâu Đài' };
  }

  // CRITICAL RULE: Can only upgrade land WHERE the player is currently standing
  const currentTile = tiles[player.position];
  if (!currentTile || currentTile.id !== propertyId) {
    return { allowed: false, reason: 'Chỉ được nâng cấp mảnh đất nơi bạn đang đặt chân đến' };
  }

  // RULE: Must land on this property in a subsequent turn (visit 2+) to build/upgrade (1 upgrade per visit)
  if (!player.visitedProperties.includes(propertyId)) {
    return { allowed: false, reason: 'Chỉ được nâng cấp Lâu Đài khi đặt chân vào ô đất này từ lần 2 (mỗi lần ghé thăm được nâng cấp 1 lần)' };
  }

  const cost = tile.houseCost;
  if (player.balance < cost) {
    return { allowed: false, reason: `Không đủ tiền (Cần ${galleons(cost)})` };
  }

  return { allowed: true };
}

/**
 * Calculates total Net Worth of a player:
 * Cash + Non-mortgaged properties full price + Mortgaged properties 50% price + Houses/Hotels value
 */
export function calculateNetWorth(player: Player, state: GameState): number {
  if (player.isBankrupt) return 0;

  const tiles = state.boardTiles || HOGWARTS_TILES;
  let netWorth = player.balance;

  player.properties.forEach((tileId) => {
    const tile = tiles.find((t) => t.id === tileId);
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
    // Bankrupt players always at bottom
    if (a.isBankrupt && !b.isBankrupt) return 1;
    if (!a.isBankrupt && b.isBankrupt) return -1;
    // Both bankrupt - same rank
    if (a.isBankrupt && b.isBankrupt) return 0;
    // Sort by net worth (descending)
    if (b.netWorth !== a.netWorth) return b.netWorth - a.netWorth;
    // Tie-breaker: more cash = higher rank
    if (b.balance !== a.balance) return b.balance - a.balance;
    // Tie-breaker: more properties = higher rank
    if (b.properties.length !== a.properties.length) return b.properties.length - a.properties.length;
    // Final tie-breaker: alphabetical by name (deterministic, not by index)
    return a.name.localeCompare(b.name);
  });
}

/**
 * Calculates Hostile Takeover Cost for landing on another player's property:
 * 2x (Base Price + All Cottages Construction Values)
 * 
 * SPECIAL RULE: When a property has been upgraded to a Castle (Hotel / Cấp tối đa),
 * it becomes an impregnable stronghold and CANNOT be bought out (returns 0).
 */
export function calculateTakeoverCost(tile: TileConfig, owner: Player): number {
  const hotelCount = owner.hotels[tile.id] || 0;
  if (hotelCount > 0) {
    return 0; // Castle is immune to takeover!
  }

  let assetValue = tile.price || 300;
  const houseCount = owner.houses[tile.id] || 0;
  const houseCost = tile.houseCost || 150;

  assetValue += houseCount * houseCost;

  return assetValue * 2;
}

