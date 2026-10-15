import { GameAction, GameState } from './types';

// Online play: the host's browser runs the reducer for everyone. Every action a seat sends (a guest's
// through HPVN, the host's own clicks too) passes here first: the acting player is the sender's
// seat, never a field of the action. Clock ticks, turbo and game setup belong to the host's runtime.
const TURN_ACTIONS = new Set([
  'ROLL_DICE', 'BUY_PROPERTY', 'PASS_PROPERTY', 'TAKEOVER_PROPERTY', 'PAY_JAIL_FINE', 'USE_JAIL_CARD',
  'DISMISS_CARD', 'END_TURN',
]);
const OWNER_ACTIONS = new Set(['BUILD_HOUSE', 'BUILD_HOTEL', 'SELL_HOUSE', 'MORTGAGE_PROPERTY', 'UNMORTGAGE_PROPERTY']);

/** The action to apply for `playerId`, or null when that seat may not do it now. */
export function authorizeAction(state: GameState, input: unknown, playerId: string): GameAction | null {
  if (!input || typeof input !== 'object') return null;
  const action = input as Record<string, unknown>;
  const type = action.type;
  if (typeof type !== 'string' || state.turnPhase === 'GAME_OVER') return null;
  const seat = state.players.find((p) => p.id === playerId);
  if (!seat || seat.isBankrupt) return null;
  const propertyId = typeof action.propertyId === 'string' && action.propertyId.length <= 40 ? action.propertyId : null;
  const current = state.players[state.currentPlayerIndex];

  // the Dark Curse notice is the same for everyone; any seat may close it (a bot never does)
  if (type === 'DISMISS_ESCALATION') return { type };

  // Allow debtor in BANKRUPTCY phase to settle debt via END_TURN (even if not the current turn player)
  if (type === 'END_TURN' && state.turnPhase === 'BANKRUPTCY' && state.bankruptcyInfo?.debtorId === playerId) {
    return { type };
  }

  if (TURN_ACTIONS.has(type)) {
    if (current?.id !== playerId) return null;
    if (type === 'BUY_PROPERTY' || type === 'TAKEOVER_PROPERTY') return propertyId ? { type, propertyId } as GameAction : null;
    return { type } as GameAction;
  }
  if (OWNER_ACTIONS.has(type)) {
    if (!propertyId || state.propertyOwnership[propertyId] !== playerId) return null;
    return { type, propertyId, playerId } as GameAction;
  }
  if (type === 'DECLARE_BANKRUPTCY') {
    return state.turnPhase === 'BANKRUPTCY' && state.bankruptcyInfo?.debtorId === playerId ? { type } : null;
  }
  if (type === 'PLACE_BID' || type === 'FOLD_AUCTION' || type === 'PASS_BID_TURN') {
    const auction = state.auction;
    if (!auction?.active || auction.activeBidders[auction.currentBidderIndex] !== playerId) return null;
    if (type === 'FOLD_AUCTION' || type === 'PASS_BID_TURN') return { type, playerId };
    const amount = action.amount;
    return typeof amount === 'number' && Number.isSafeInteger(amount) && amount > auction.currentBid ? { type, playerId, amount } : null;
  }
  if (type === 'SELECT_DRAFT_PROPERTY') {
    const draft = state.bankruptcyDraft;
    if (!draft) return null;
    const currentDrafterId = draft.draftOrder[draft.currentDraftIndex];
    if (currentDrafterId !== playerId) return null;
    if (!propertyId || !draft.availablePropertyIds.includes(propertyId)) return null;
    return { type, propertyId, playerId };
  }
  return null;
}
