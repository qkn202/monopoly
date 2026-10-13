export type HouseType = 'Gryffindor' | 'Slytherin' | 'Ravenclaw' | 'Hufflepuff' | 'Auror' | 'DeathEater' | 'OrderOfPhoenix' | 'Ministry';

export type TileType =
  | 'GO'
  | 'PROPERTY'
  | 'STATION'
  | 'UTILITY'
  | 'CHARMS'
  | 'POTIONS'
  | 'TAX'
  | 'JAIL'
  | 'GO_TO_JAIL'
  | 'FREE_PARKING';

export type ColorGroup =
  | 'BROWN'
  | 'LIGHT_BLUE'
  | 'PINK'
  | 'ORANGE'
  | 'RED'
  | 'YELLOW'
  | 'GREEN'
  | 'DARK_BLUE'
  | 'STATION'
  | 'UTILITY';

export interface TileConfig {
  id: string;
  index: number;
  name: string;
  type: TileType;
  colorGroup?: ColorGroup;
  price?: number;
  baseRent?: number;
  rentTiers?: number[]; // [base, 1 cottage, 2 cottages, 3 cottages, 4 cottages, 1 castle]
  houseCost?: number;
  mortgageValue?: number;
  description?: string;
  icon?: string;
}

export interface Player {
  id: string;
  name: string;
  house: HouseType;
  color: string;
  tokenIcon: string;
  balance: number; // Galleons
  position: number; // 0 to 39
  properties: string[]; // Tile IDs
  visitedProperties: string[]; // Tile IDs visited since last build (can only build after visiting)
  inJail: boolean;
  jailTurnsRemaining: number;
  getOutOfJailCards: number;
  isBankrupt: boolean;
  isAI: boolean;
  houses: Record<string, number>; // tileId -> number of cottages (0-4)
  hotels: Record<string, number>; // tileId -> 1 if castle built
  netWorth: number;
  bankruptcyDetails?: BankruptcyDetails | null;
}

export interface DiceRoll {
  die1: number;
  die2: number;
  total: number;
  isDouble: boolean;
}

export interface AuctionState {
  active: boolean;
  propertyId: string;
  currentBid: number;
  startingBid?: number; // Mức giá khởi điểm đấu giá
  starterId?: string; // Người bắt đầu đấu giá (người bỏ qua mua ban đầu)
  starterFolded?: boolean; // Người bắt đầu đã bấm rút lui hay chưa
  highBidderId: string | null;
  activeBidders: string[]; // List of playerIds still in the auction
  currentBidderIndex: number;
  timerSeconds: number; // 7s countdown
}

export interface TradeOffer {
  id: string;
  senderId: string;
  receiverId: string;
  offeredGalleons: number;
  offeredProperties: string[];
  requestedGalleons: number;
  requestedProperties: string[];
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
}

export interface GameTimer {
  durationSeconds: number; // Default 1800 (30 mins)
  remainingSeconds: number;
  isExpired: boolean;
  isPaused: boolean;
}

export interface GameEvent {
  id: string;
  timestamp: number;
  message: string;
  playerId?: string;
  targetPlayerId?: string;
  involvedPlayerIds?: string[];
  type: 'info' | 'success' | 'warning' | 'error';
}

export interface CardConfig {
  id: string;
  title: string;
  description: string;
  action: 'MONEY' | 'MOVE' | 'MOVE_TO' | 'JAIL' | 'GET_OUT_OF_JAIL' | 'REPAIRS' | 'PAY_PLAYERS';
  amount?: number;
  targetTileIndex?: number;
}

export type TurnPhase =
  | 'ROLL'
  | 'ACTION' // Landed on unowned property (can buy or pass to auction)
  | 'AUCTION' // Mandatory public auction
  | 'BANKRUPTCY' // Player must mortgage/sell before declaring bankruptcy
  | 'END_TURN'
  | 'GAME_OVER';

export interface RentPaymentRecord {
  debtorId: string;
  creditorId?: string;
  amount: number;
  tileId: string;
  timestamp: number;
  isTax?: boolean;
}

export interface TakeoverCandidate {
  propertyId: string;
  cost: number;
  ownerId: string;
  ownerName: string;
}

export interface UpgradeCandidate {
  propertyId: string;
  cost: number;
  currentHouses: number;
  hasHotel: boolean;
  isHotelUpgrade: boolean;
}

export interface BankruptcyDraft {
  debtorId: string;
  debtorName: string;
  creditorId?: string;
  availablePropertyIds: string[];
  draftOrder: string[]; // array of playerIds in pick order (poorest first, round-robin)
  currentDraftIndex: number;
  propsPerPlayer: number;
  initialCashPool: number;
  timerSeconds: number;
  history: Array<{
    playerId: string;
    playerName: string;
    propertyId: string;
    propertyName: string;
  }>;
}

export interface BankruptcyInfo {
  debtorId: string;
  creditorId?: string;
  amount: number;
  reason: string;
}

export interface BankruptcyDetails {
  debtorId: string;
  debtorName: string;
  debtorHouse: HouseType;
  debtorColor: string;
  creditorId?: string;
  creditorName?: string;
  creditorHouse?: HouseType;
  debtAmount: number;
  reason: string;
  tileId?: string;
  tileName?: string;
  timestamp: number;
  humorousTitle: string;
  humorousQuote: string;
  humorousPunishment: string;
  statSummary?: {
    totalLost: number;
    highestRentPaid: number;
    jailVisits: number;
    propertiesLost: number;
  };
}

export type TransactionCategory =
  | 'RENT'
  | 'TAX'
  | 'GO'
  | 'BUY'
  | 'BUILD'
  | 'CARD'
  | 'JAIL'
  | 'TAKEOVER'
  | 'AUCTION'
  | 'PARKING'
  | 'MORTGAGE'
  | 'OTHER';

export interface CashTransaction {
  id: string;
  turnIndex: number;
  roundNumber: number;
  timestamp: number;
  playerId: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE';
  category: TransactionCategory;
  description: string;
  tileId?: string;
  counterpartyPlayerId?: string;
}

export interface TurnCashflow {
  turnIndex: number;
  roundNumber: number;
  playerId: string;
  playerName: string;
  playerColor: string;
  playerHouse: HouseType;
  totalIncome: number;
  totalExpense: number;
  net: number;
  transactions: CashTransaction[];
  timestamp: number;
}

export interface PlayerFinanceStats {
  totalIncome: number;
  totalExpense: number;
  rentIncome: number;
  rentExpense: number;
  taxExpense: number;
  landVisitsCount?: number;
}

export interface PropertyRevenueStat {
  totalRentCollected: number;
  rentCount: number;
  lastRentCollected?: number;
  lastPayerName?: string;
}

export interface GameState {
  players: Player[];
  currentPlayerIndex: number;
  turnPhase: TurnPhase;
  turnNumber: number;
  dice: DiceRoll | null;
  consecutiveDoubles: number;
  propertyOwnership: Record<string, string>; // tileId -> playerId
  mortgagedProperties: Record<string, boolean>; // tileId -> true
  auction: AuctionState | null;
  activeTrade: TradeOffer | null;
  timer: GameTimer;
  charmsDeck: CardConfig[];
  potionsDeck: CardConfig[];
  activeCard: CardConfig | null;
  events: GameEvent[];
  winner: Player | null;
  freeParkingPot: number;
  lastRentPayment?: RentPaymentRecord | null;
  turnSecondsRemaining: number; // 60s per turn limit
  maxTurnSeconds: number; // Default 60s
  turboMode?: boolean; // Fast mode (2x speed, fast bot AI, quick animations)
  rentMultiplier: number; // Global rent & tax multiplier (default 1, e.g. 2x, 3x, 4x, 5x)
  nextEscalationRound: number; // Target round number for next random escalation
  bankruptcyInfo?: BankruptcyInfo | null; // Info when player is in BANKRUPTCY phase
  bankruptcyDraft?: BankruptcyDraft | null; // Active drafting session for bankrupt player assets
  maxRentMultiplier: number; // Cap (now 5)
  lastEscalationMinute?: number; // Minute milestone when last escalation triggered (15, 20, 25...)
  activeEscalationEvent?: EscalationEvent | null;
  takeoverCandidate?: TakeoverCandidate | null;
  upgradeCandidate?: UpgradeCandidate | null;
  turnFinances?: TurnCashflow[];
  currentTurnTransactions?: CashTransaction[];
  playerFinances?: Record<string, PlayerFinanceStats>;
  propertyRevenue?: Record<string, PropertyRevenueStat>;
  boardSize?: number; // 20, 28, or 40 (default 40)
  boardTiles?: TileConfig[]; // Active tile list for this board
  lastBankruptcyDetails?: BankruptcyDetails | null;
}

export interface EscalationEvent {
  multiplier: number;
  round: number;
  minute?: number;
  timestamp: number;
  message: string;
}

export type GameAction =
  | { type: 'START_GAME'; players: Array<{ name: string; house: HouseType; isAI: boolean }>; boardSize?: number }
  | { type: 'ROLL_DICE'; forceRoll?: [number, number] }
  | { type: 'BUY_PROPERTY'; propertyId: string }
  | { type: 'PASS_PROPERTY' }
  | { type: 'TAKEOVER_PROPERTY'; propertyId: string }
  | { type: 'PLACE_BID'; playerId: string; amount: number }
  | { type: 'FOLD_AUCTION'; playerId: string }
  | { type: 'PASS_BID_TURN'; playerId: string }
  | { type: 'AUCTION_TICK' }
  | { type: 'BUILD_HOUSE'; propertyId: string; playerId?: string }
  | { type: 'BUILD_HOTEL'; propertyId: string; playerId?: string }
  | { type: 'SELL_HOUSE'; propertyId: string; playerId?: string }
  | { type: 'MORTGAGE_PROPERTY'; propertyId: string; playerId?: string }
  | { type: 'UNMORTGAGE_PROPERTY'; propertyId: string; playerId?: string }
  | { type: 'PAY_JAIL_FINE' }
  | { type: 'USE_JAIL_CARD' }
  | { type: 'PROPOSE_TRADE'; offer: Omit<TradeOffer, 'id' | 'status'> }
  | { type: 'RESPOND_TRADE'; accept: boolean }
  | { type: 'DISMISS_CARD' }
  | { type: 'END_TURN' }
  | { type: 'TIMER_TICK' }
  | { type: 'TURN_TIMEOUT' }
  | { type: 'TOGGLE_TURBO' }
  | { type: 'SET_TURBO'; enabled: boolean }
  | { type: 'DISMISS_ESCALATION' }
  | { type: 'DECLARE_BANKRUPTCY' }
  | { type: 'SELECT_DRAFT_PROPERTY'; propertyId: string; playerId?: string };
