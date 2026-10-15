import React, { useState, useEffect } from 'react';
import { GameState, GameAction } from '../core/types';
import { HOGWARTS_TILES, COLOR_GROUP_STYLES, HOUSE_INFO } from '../core/boardData';
import { getTileAssetId } from '../core/boardVariants';
import { determineLeaderboard, canBuildHouse, canBuildHotel, canMortgageProperty, canUnmortgageProperty } from '../core/rulesEngine';
import { isEventRelevantToPlayer } from '../core/reducerHelpers';
import { soundManager } from '../audio/soundManager';
import { openFloo, usePhoneFloo } from '../hpvn/usePhoneFloo';
import { Icon } from '../hpvn/Icon';
import { useHudInsets } from '../hpvn/useHudInsets';
import { BankruptcyConfirmModal } from './BankruptcyConfirmModal';
import { getSpectatorUrl } from '../core/spectatorSync';
import './RightSidebar.css';
import { g, galleons } from '../hpvn/money';

// The log reads as plain sentences; the colored left rule already carries the event type.
const LEADING_EMOJI = /^[\p{Extended_Pictographic}\uFE0F\u200D\s]+/u;

interface RightSidebarProps {
  gameState: GameState;
  dispatch: (action: GameAction) => void;
  roomCode?: string;
  myPlayerId?: string;
  isHost?: boolean;
  isSpectator?: boolean;
  /** Leave the table: a local game is parked for 30 minutes, an online seat leaves the room. */
  onExit?: () => void | Promise<void>;
  /** Galleons this seat loses by leaving a running staked match (0 = nothing at stake). */
  stakeAtRisk?: number;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({
  gameState,
  dispatch,
  roomCode,
  myPlayerId,
  isHost = true,
  isSpectator = false,
  onExit,
  stakeAtRisk = 0,
}) => {
  const [confirmExit, setConfirmExit] = useState(false);
  const [showBankruptcyConfirm, setShowBankruptcyConfirm] = useState(false);
  const phoneFloo = usePhoneFloo(true);
  useHudInsets();
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'properties' | 'events' | 'finances'>('properties');
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [selectedPropertyPlayerId, setSelectedPropertyPlayerId] = useState<string | null>(null);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    if (gameState.turnPhase !== 'BANKRUPTCY') {
      setShowBankruptcyConfirm(false);
    }
  }, [gameState.turnPhase]);

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const isMyTurn = isSpectator ? false : (myPlayerId ? currentPlayer?.id === myPlayerId : true);

  const myPlayer = myPlayerId ? gameState.players.find((p) => p.id === myPlayerId) : null;
  const viewingPlayerId = selectedPropertyPlayerId || myPlayer?.id || currentPlayer?.id;
  const viewingPlayer = gameState.players.find((p) => p.id === viewingPlayerId) || currentPlayer;
  const isDebtorInBankruptcy = gameState.turnPhase === 'BANKRUPTCY' && gameState.bankruptcyInfo?.debtorId === viewingPlayer?.id;
  const isControllingViewingPlayer = !isSpectator && (
    myPlayerId ? viewingPlayer?.id === myPlayerId : (viewingPlayer?.id === currentPlayer?.id || isDebtorInBankruptcy)
  );

  const currentBidderId = gameState.auction?.active
    ? gameState.auction.activeBidders[gameState.auction.currentBidderIndex]
    : null;
  const currentBidder = currentBidderId
    ? gameState.players.find((p) => p.id === currentBidderId)
    : null;
  // Solo/hotseat: only a human seat bids from these buttons; bots bid through botAI (never spectator).
  const isMyBidTurn = !isSpectator && (myPlayerId ? currentBidderId === myPlayerId : !!currentBidder && !currentBidder.isAI);
  const baseUrl = import.meta.env.BASE_URL || '/';

  // Format 30m countdown timer
  const minutes = Math.floor(gameState.timer.remainingSeconds / 60);
  const seconds = gameState.timer.remainingSeconds % 60;
  const timeFormatted = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  const timerClass =
    gameState.timer.remainingSeconds < 120
      ? 'danger'
      : gameState.timer.remainingSeconds < 300
      ? 'warning'
      : '';

  const turnSec = gameState.turnSecondsRemaining ?? 60;
  const turnTimerClass =
    turnSec <= 5
      ? 'danger pulse-fast'
      : turnSec <= 15
      ? 'warning pulse'
      : '';

  const leaderboard = determineLeaderboard(gameState);

  const copyRoomCode = () => {
    if (roomCode) {
      navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const copySpectatorLink = () => {
    if (roomCode) {
      navigator.clipboard.writeText(getSpectatorUrl(roomCode));
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2200);
    }
  };

  const boardTiles = gameState.boardTiles || HOGWARTS_TILES;
  const landedTile = currentPlayer ? boardTiles[currentPlayer.position] : null;
  const ownerId = landedTile ? gameState.propertyOwnership[landedTile.id] : undefined;
  const owner = ownerId ? gameState.players.find((p) => p.id === ownerId) : undefined;

  const [muted, setMuted] = useState(soundManager.getMuted());

  const toggleSound = () => {
    const isNowMuted = soundManager.toggleMute();
    setMuted(isNowMuted);
  };

  // "You" is the seat this screen controls; in solo that is the one human seat. For pure spectators, me is null.
  const me = myPlayer || (!isSpectator ? gameState.players.find((p) => !p.isAI) || currentPlayer : null);
  const myBuildings = me
    ? Object.values(me.houses).reduce((a, b) => a + b, 0) + Object.values(me.hotels).reduce((a, b) => a + b, 0)
    : 0;
  const colorSets = Object.keys(COLOR_GROUP_STYLES)
    .filter((g) => g !== 'STATION' && g !== 'UTILITY')
    .map((g) => {
      const tiles = boardTiles.filter((t) => t.colorGroup === g);
      const owned = tiles.filter((t) => me && gameState.propertyOwnership[t.id] === me.id).length;
      return { g, color: COLOR_GROUP_STYLES[g].bg, name: COLOR_GROUP_STYLES[g].name, frac: tiles.length ? owned / tiles.length : 0, owned, total: tiles.length };
    });

  const timerRing = (size = 36) => {
    const r = size / 2 - 3;
    const c = 2 * Math.PI * r;
    return (
      <div className={`hpvn-ring ${turnSec <= 10 ? 'is-low' : ''}`} style={{ width: size, height: size }} title="Thời gian lượt này">
        <svg width={size} height={size} aria-hidden="true">
          <circle cx={size / 2} cy={size / 2} r={r} className="hpvn-ring-track" />
          <circle cx={size / 2} cy={size / 2} r={r} className="hpvn-ring-fill" strokeDasharray={c}
            strokeDashoffset={c * (1 - Math.max(0, Math.min(60, turnSec)) / 60)} />
        </svg>
        <b>{turnSec}</b>
      </div>
    );
  };

  const targetPlayerForLog = viewingPlayer || me;
  const myEventsCount = targetPlayerForLog
    ? gameState.events.filter((e) => isEventRelevantToPlayer(e, targetPlayerForLog, gameState.players)).length
    : 0;

  const userRelevantEvents = targetPlayerForLog
    ? gameState.events.filter((e) => isEventRelevantToPlayer(e, targetPlayerForLog, gameState.players))
    : gameState.events;
  const recentEvents = userRelevantEvents.length > 0 ? userRelevantEvents.slice(0, 2) : gameState.events.slice(0, 2);

  const openDrawerWithTab = (tab: 'leaderboard' | 'properties' | 'events' | 'finances') => {
    setActiveTab(tab);
    setIsMobileDrawerOpen(true);
  };

  // --- Sub-renderers ---
  const renderTurnActions = (isMobile = false) => {
    if (!currentPlayer) return null;

    if (isSpectator) {
      return (
        <div className={`turn-action-content spectator-turn-content ${isMobile ? 'mobile-turn-content' : ''}`}>
          <div className="spectator-action-card">
            <div className="spectator-card-badge">
              <span className="live-dot" />
              <span>CHẾ ĐỘ KHÁN GIẢ · ĐANG THEO DÕI</span>
            </div>

            <div className="spectator-current-player-row">
              <span
                className="player-avatar-circle mini-avatar"
                style={{ borderColor: currentPlayer.color, background: `${currentPlayer.color}22` }}
              >
                {currentPlayer.tokenIcon}
              </span>
              <div className="spectator-current-text">
                <span className="spectator-label">Lượt hiện tại:</span>
                <strong style={{ color: currentPlayer.color }}>{currentPlayer.name}</strong>
                <small style={{ color: '#bb9c7c' }}> ({currentPlayer.house})</small>
              </div>
            </div>

            <div className="spectator-phase-message">
              {gameState.turnPhase === 'ROLL' && (
                <span>
                  🎲 {currentPlayer.inJail ? `${currentPlayer.name} đang ở Azkaban (Cần trả bảo lãnh hoặc gieo xúc xắc)…` : `Đang chờ ${currentPlayer.name} gieo xúc xắc…`}
                </span>
              )}
              {gameState.turnPhase === 'ACTION' && (
                <span>
                  {gameState.takeoverCandidate
                    ? `⚡ ${currentPlayer.name} đang cân nhắc mua đứt ${landedTile?.name}!`
                    : gameState.upgradeCandidate
                    ? `🏰 ${currentPlayer.name} đang cân nhắc nâng cấp ${landedTile?.name}!`
                    : landedTile && !ownerId && landedTile.price
                    ? `🏰 ${currentPlayer.name} đang cân nhắc mua hoặc đấu giá ${landedTile.name}…`
                    : `⚖️ ${currentPlayer.name} đang xem xét ô đất ${landedTile?.name || 'hiện tại'}…`}
                </span>
              )}
              {gameState.turnPhase === 'AUCTION' && gameState.auction && (
                <span>
                  🏛️ Đang đấu giá ô <strong>{gameState.auction.propertyId}</strong>.
                  <br />
                  Lượt ra giá: <strong style={{ color: '#f3d189' }}>{currentBidder?.name || 'Người chơi'}</strong> (Hiện tại: {galleons(gameState.auction.currentBid)})
                </span>
              )}
              {gameState.turnPhase === 'BANKRUPTCY' && (
                <span>⚡ {currentPlayer.name} đang xử lý nợ / giải quyết phá sản…</span>
              )}
              {gameState.turnPhase === 'END_TURN' && (
                <span>⏳ Đang hoàn tất lượt của {currentPlayer.name}…</span>
              )}
              {gameState.turnPhase === 'GAME_OVER' && (
                <span>🏆 Ván đấu đã kết thúc! Người thắng: {gameState.winner?.name}</span>
              )}
            </div>

            <div className="spectator-guide-note">
              💡 <em>Bạn có thể click trực tiếp vào các ô đất trên bàn cờ 3D hoặc chuyển tab để xem chi tiết tài sản của từng người chơi.</em>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={`turn-action-content ${isMobile ? 'mobile-turn-content' : ''}`}>
        {/* Actions based on turn phase */}
        {gameState.turnPhase === 'ROLL' && (
          <div>
            {currentPlayer.inJail && isMyTurn && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '8px' }}>
                <button
                  className="btn-bid"
                  disabled={!isMyTurn || currentPlayer.balance < 150}
                  onClick={() => dispatch({ type: 'PAY_JAIL_FINE' })}
                >
                  Nộp 150G Bảo Lãnh
                </button>
                <button
                  className="btn-bid"
                  disabled={!isMyTurn || currentPlayer.getOutOfJailCards <= 0}
                  onClick={() => dispatch({ type: 'USE_JAIL_CARD' })}
                >
                  Dùng Thẻ Miễn Giam
                </button>
              </div>
            )}
            {currentPlayer.inJail && !isMyTurn && (
              <div style={{ textAlign: 'center', color: '#bb9c7c', fontSize: '0.85rem', marginBottom: '8px', padding: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                Đang chờ {currentPlayer.name} trả tiền bảo lãnh…
              </div>
            )}
            <button
              className="btn-primary-roll"
              disabled={!isMyTurn}
              onClick={() => dispatch({ type: 'ROLL_DICE' })}
            >
              {isMyTurn ? <>Gieo xúc xắc <kbd className="hpvn-key">Space</kbd></> : `Đang chờ ${currentPlayer.name}…`}
            </button>
          </div>
        )}

        {gameState.turnPhase === 'ACTION' && gameState.takeoverCandidate && landedTile && (
          <div className="landed-decision-box magical-decision-box hostile-takeover-box">
            <div className="decision-corner tl" />
            <div className="decision-corner tr" />
            <div className="decision-corner bl" />
            <div className="decision-corner br" />

            <div className="decision-card-row">
              <div className="decision-card-thumb-wrap">
                <img
                  src={`${baseUrl}assets/cards/tile_${getTileAssetId(landedTile)}.webp`}
                  alt={landedTile.name}
                  className="decision-card-thumb-img"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                <div className="decision-thumb-seal">⚡</div>
              </div>

              <div className="decision-card-text">
                <div className="decision-tag takeover-tag">
                  Thâu tóm đất
                </div>
                <div className="landed-tile-title">
                  {landedTile.name}
                </div>
                <div className="landed-tile-price">
                  Chủ hiện tại: <strong style={{ color: '#f3d189' }}>{gameState.takeoverCandidate.ownerName}</strong>
                  <br />
                  Giá mua đứt (x2): <strong style={{ color: '#f3d189' }}>{galleons(gameState.takeoverCandidate.cost)}</strong>
                  <br />
                  <span style={{ fontSize: '0.72rem', color: '#bb9c7c', fontStyle: 'italic' }}>
                    *Chủ đất bắt buộc nhượng lại và nhận toàn bộ số tiền này.
                  </span>
                </div>
              </div>
            </div>

            <div className="decision-button-row">
              <button
                className="btn-takeover"
                disabled={!isMyTurn || currentPlayer.balance < gameState.takeoverCandidate.cost}
                onClick={() => dispatch({ type: 'TAKEOVER_PROPERTY', propertyId: landedTile.id })}
              >
                Mua đứt · {g(gameState.takeoverCandidate.cost)} <kbd className="hpvn-key">B</kbd>
              </button>
              <button
                className="btn-pass-auction"
                disabled={!isMyTurn}
                onClick={() => dispatch({ type: 'PASS_PROPERTY' })}
              >
                Bỏ Qua [P / Space]
              </button>
            </div>
          </div>
        )}

        {gameState.turnPhase === 'ACTION' && gameState.upgradeCandidate && landedTile && (
          <div className="landed-decision-box magical-decision-box upgrade-decision-box">
            <div className="decision-corner tl" />
            <div className="decision-corner tr" />
            <div className="decision-corner bl" />
            <div className="decision-corner br" />

            <div className="decision-card-row">
              <div className="decision-card-thumb-wrap">
                <img
                  src={`${baseUrl}assets/cards/tile_${getTileAssetId(landedTile)}.webp`}
                  alt={landedTile.name}
                  className="decision-card-thumb-img"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                <div className="decision-thumb-seal">{gameState.upgradeCandidate.isHotelUpgrade ? '🏰' : '🛖'}</div>
              </div>

              <div className="decision-card-text">
                <div className="decision-tag upgrade-tag">
                  Nâng cấp đất
                </div>
                <div className="landed-tile-title">
                  {landedTile.name}
                </div>
                <div className="landed-tile-price">
                  {gameState.upgradeCandidate.isHotelUpgrade ? (
                    <>
                      Đang có: <strong style={{ color: '#f3d189' }}>4 túp lều</strong>
                      <br />
                      Lên cấp: <strong style={{ color: '#f3d189' }}>Lâu đài (tối đa)</strong>
                    </>
                  ) : (
                    <>
                      Đang có:{' '}
                      <strong style={{ color: '#f3d189' }}>
                        {gameState.upgradeCandidate.currentHouses > 0
                          ? `${gameState.upgradeCandidate.currentHouses} túp lều`
                          : 'Chưa có nhà'}
                      </strong>
                      <br />
                      Xây thêm: <strong style={{ color: '#f3d189' }}>túp lều thứ {gameState.upgradeCandidate.currentHouses + 1} / 4</strong>
                    </>
                  )}
                  <br />
                  Chi phí: <strong style={{ color: '#f3d189' }}>{galleons(gameState.upgradeCandidate.cost)}</strong>
                </div>
              </div>
            </div>

            <div className="decision-button-row">
              {gameState.upgradeCandidate.isHotelUpgrade ? (
                <button
                  className="btn-upgrade-hotel"
                  disabled={!isMyTurn || currentPlayer.balance < gameState.upgradeCandidate.cost}
                  onClick={() =>
                    dispatch({
                      type: 'BUILD_HOTEL',
                      propertyId: landedTile.id,
                      playerId: currentPlayer.id,
                    })
                  }
                >
                  Lên lâu đài · {g(gameState.upgradeCandidate.cost)} <kbd className="hpvn-key">B</kbd>
                </button>
              ) : (
                <button
                  className="btn-buy"
                  disabled={!isMyTurn || currentPlayer.balance < gameState.upgradeCandidate.cost}
                  onClick={() =>
                    dispatch({
                      type: 'BUILD_HOUSE',
                      propertyId: landedTile.id,
                      playerId: currentPlayer.id,
                    })
                  }
                >
                  Xây lều · {g(gameState.upgradeCandidate.cost)} <kbd className="hpvn-key">B</kbd>
                </button>
              )}
              <button
                className="btn-pass-auction"
                disabled={!isMyTurn}
                onClick={() => dispatch({ type: 'PASS_PROPERTY' })}
              >
                Bỏ Qua [P / Space]
              </button>
            </div>
          </div>
        )}

        {gameState.turnPhase === 'ACTION' && !gameState.takeoverCandidate && !gameState.upgradeCandidate && landedTile && !ownerId && (
          <div className="landed-decision-box magical-decision-box">
            <div className="decision-corner tl" />
            <div className="decision-corner tr" />
            <div className="decision-corner bl" />
            <div className="decision-corner br" />

            <div className="decision-card-row">
              <div className="decision-card-thumb-wrap">
                <img
                  src={`${baseUrl}assets/cards/tile_${getTileAssetId(landedTile)}.webp`}
                  alt={landedTile.name}
                  className="decision-card-thumb-img"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                <div className="decision-thumb-seal">{landedTile.icon || '🏰'}</div>
              </div>

              <div className="decision-card-text">
                <div className="decision-tag">
                  Mua đất
                </div>
                <div className="landed-tile-title">
                  {landedTile.name}
                </div>
                <div className="landed-tile-price">
                  Giá mua: <strong style={{ color: '#f3d189' }}>{galleons(landedTile.price)}</strong>
                  <br />
                  Tiền thuê:{' '}
                  <strong style={{ color: gameState.rentMultiplier > 1 ? '#f87171' : '#e0cfab' }}>
                    {g((landedTile.baseRent || 0) * (gameState.rentMultiplier || 1))}
                  </strong>
                  {gameState.rentMultiplier > 1 && (
                    <span className="curse-badge-small">
                      (x{gameState.rentMultiplier})
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="decision-button-row">
              <button
                className="btn-buy"
                disabled={!isMyTurn || currentPlayer.balance < (landedTile.price || 0)}
                onClick={() => dispatch({ type: 'BUY_PROPERTY', propertyId: landedTile.id })}
              >
                Mua · {g(landedTile.price)} <kbd className="hpvn-key">B</kbd>
              </button>
              <button
                className="btn-pass-auction"
                disabled={!isMyTurn}
                onClick={() => dispatch({ type: 'PASS_PROPERTY' })}
              >
                Đấu giá <kbd className="hpvn-key">P</kbd>
              </button>
            </div>
          </div>
        )}

        {gameState.turnPhase === 'AUCTION' && gameState.auction && (
          <div className="auction-box">
            <div className="auction-title-row">
              <div className="auction-title">Đấu giá</div>
              <div className="auction-countdown">{gameState.auction.timerSeconds}s</div>
            </div>
            <div className="auction-bid-row">
              <div>
                {gameState.auction.highBidderId ? 'Giá cao nhất: ' : 'Giá khởi điểm: '}
                <strong style={{ color: '#f3d189' }}>{galleons(gameState.auction.currentBid)}</strong>
              </div>
              <div style={{ fontSize: '0.78rem', color: '#bb9c7c' }}>
                {gameState.auction.highBidderId
                  ? `Dẫn đầu: ${gameState.players.find((p) => p.id === gameState.auction?.highBidderId)?.name}`
                  : `Khởi xướng: ${gameState.players.find((p) => p.id === (gameState.auction?.starterId ?? gameState.auction?.activeBidders[0]))?.name || 'Chưa rõ'}`}
              </div>
            </div>

            {isMyBidTurn && currentBidderId === (gameState.auction.starterId ?? gameState.auction.activeBidders[0]) && !gameState.auction.highBidderId && (
              <div
                style={{
                  margin: '6px 0',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  background: 'rgba(243, 209, 137, 0.12)',
                  border: '1px solid rgba(243, 209, 137, 0.3)',
                  fontSize: '0.74rem',
                  color: '#f3d189',
                  lineHeight: 1.35,
                }}
              >
                ⭐ <strong>Bạn là người bắt đầu:</strong> Nếu nhường lượt và tất cả người sau không tham gia, ô đất sẽ thuộc về bạn với giá khởi điểm <strong>{galleons(gameState.auction.currentBid)}</strong>. Bạn chỉ mất quyền ưu tiên khi bấm <strong>Rút lui</strong>.
              </div>
            )}

            <div style={{ margin: '6px 0', fontSize: '0.8rem', textAlign: 'center' }}>
              {isMyBidTurn ? (
                <strong style={{ color: '#f3d189' }}>Đến lượt bạn ra giá</strong>
              ) : (
                <span style={{ color: '#bb9c7c' }}>
                  Đang chờ <strong>{currentBidder?.name || 'người chơi'}</strong> ra giá…
                </span>
              )}
            </div>

            <div className="bid-controls-grid">
              <button
                className="btn-bid"
                disabled={!isMyBidTurn || !currentBidderId || (currentBidder?.balance || 0) < gameState.auction.currentBid + 25}
                onClick={() =>
                  dispatch({
                    type: 'PLACE_BID',
                    playerId: currentBidderId!,
                    amount: gameState.auction!.currentBid + 25,
                  })
                }
              >
                +{g(25)}
              </button>
              <button
                className="btn-bid"
                disabled={!isMyBidTurn || !currentBidderId || (currentBidder?.balance || 0) < gameState.auction.currentBid + 50}
                onClick={() =>
                  dispatch({
                    type: 'PLACE_BID',
                    playerId: currentBidderId!,
                    amount: gameState.auction!.currentBid + 50,
                  })
                }
              >
                +{g(50)}
              </button>
              <button
                className="btn-bid"
                disabled={!isMyBidTurn || !currentBidderId || (currentBidder?.balance || 0) < gameState.auction.currentBid + 100}
                onClick={() =>
                  dispatch({
                    type: 'PLACE_BID',
                    playerId: currentBidderId!,
                    amount: gameState.auction!.currentBid + 100,
                  })
                }
              >
                +{g(100)}
              </button>
              <button
                className="btn-fold"
                disabled={!isMyBidTurn || !currentBidderId}
                onClick={() => dispatch({ type: 'FOLD_AUCTION', playerId: currentBidderId! })}
              >
                Rút lui
              </button>
            </div>

            {isMyBidTurn && currentBidderId === (gameState.auction.starterId ?? gameState.auction.activeBidders[0]) && !gameState.auction.highBidderId && (
              <button
                className="btn-pass-bid-turn"
                style={{
                  width: '100%',
                  marginTop: '6px',
                  padding: '7px 8px',
                  background: 'rgba(59, 130, 246, 0.2)',
                  border: '1px solid rgba(59, 130, 246, 0.45)',
                  color: '#93c5fd',
                  borderRadius: '6px',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease',
                }}
                onClick={() => dispatch({ type: 'PASS_BID_TURN', playerId: currentBidderId! })}
              >
                ⏭️ Nhường lượt (chờ người khác trả giá)
              </button>
            )}
          </div>
        )}

        {gameState.turnPhase === 'END_TURN' && (
          <div className="end-turn-action-box">
            {/* 1. If rent was paid on this turn */}
            {gameState.lastRentPayment && !gameState.lastRentPayment.isTax && (
              <div className="landed-receipt-card rent-paid magical-receipt">
                <div className="receipt-corner tl" />
                <div className="receipt-corner tr" />
                <div className="receipt-corner bl" />
                <div className="receipt-corner br" />
                <div className="receipt-split-body">
                  {landedTile && (
                    <div className="receipt-card-thumb-wrap">
                      <img
                        src={`${baseUrl}assets/cards/tile_${getTileAssetId(landedTile)}.webp`}
                        alt={landedTile.name}
                        className="receipt-card-thumb-img"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                      <div className="receipt-thumb-badge">💸</div>
                    </div>
                  )}
                  <div className="receipt-info-area">
                    <div className="receipt-header">
                      <span className="receipt-badge-rent">Trả tiền thuê</span>
                      <span className="receipt-amount-neg">−{g(gameState.lastRentPayment.amount)}</span>
                    </div>
                    <div className="receipt-tile-name">
                      {landedTile?.icon} {landedTile?.name}
                    </div>
                    <div className="receipt-details">
                      <div className="receipt-line">
                        <span>Người dừng chân:</span>
                        <strong>{gameState.players.find((p) => p.id === gameState.lastRentPayment?.debtorId)?.name}</strong>
                      </div>
                      <div className="receipt-line">
                        <span>Chủ sở hữu:</span>
                        <strong style={{ color: gameState.players.find((p) => p.id === gameState.lastRentPayment?.creditorId)?.color || '#f3d189' }}>
                          {gameState.players.find((p) => p.id === gameState.lastRentPayment?.creditorId)?.name}
                        </strong>
                      </div>
                      {gameState.rentMultiplier > 1 && (
                        <div className="receipt-line" style={{ color: '#f87171' }}>
                          <span>Hiệu ứng:</span>
                          <strong>Đã x{gameState.rentMultiplier} do Lời nguyền Hắc ám</strong>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="receipt-status-msg">
                  {isMyTurn ? 'Bạn vừa dừng chân tại ô đất này và đã thanh toán tiền thuê.' : 'Đã thanh toán tiền thuê cho chủ sở hữu ô đất.'}
                </div>
              </div>
            )}

            {/* 2. If tax was paid on this turn */}
            {gameState.lastRentPayment && gameState.lastRentPayment.isTax && (
              <div className="landed-receipt-card tax-paid magical-receipt">
                <div className="receipt-corner tl" />
                <div className="receipt-corner tr" />
                <div className="receipt-corner bl" />
                <div className="receipt-corner br" />
                <div className="receipt-split-body">
                  {landedTile && (
                    <div className="receipt-card-thumb-wrap">
                      <img
                        src={`${baseUrl}assets/cards/tile_${getTileAssetId(landedTile)}.webp`}
                        alt={landedTile.name}
                        className="receipt-card-thumb-img"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                      <div className="receipt-thumb-badge" style={{ background: '#7c3aed' }}>⚖️</div>
                    </div>
                  )}
                  <div className="receipt-info-area">
                    <div className="receipt-header">
                      <span className="receipt-badge-tax">Nộp thuế</span>
                      <span className="receipt-amount-neg">−{g(gameState.lastRentPayment.amount)}</span>
                    </div>
                    <div className="receipt-tile-name">
                      {landedTile?.icon} {landedTile?.name}
                    </div>
                    <div className="receipt-details">
                      <div className="receipt-line">
                        <span>Người nộp thuế:</span>
                        <strong>{gameState.players.find((p) => p.id === gameState.lastRentPayment?.debtorId)?.name}</strong>
                      </div>
                      <div className="receipt-line">
                        <span>Quỹ Cứu Tế:</span>
                        <strong style={{ color: '#f3d189' }}>{galleons(gameState.freeParkingPot)}</strong>
                      </div>
                      {gameState.rentMultiplier > 1 && (
                        <div className="receipt-line" style={{ color: '#c084fc' }}>
                          <span>Hiệu ứng:</span>
                          <strong>Đã x{gameState.rentMultiplier} do Lời nguyền Hắc ám</strong>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="receipt-status-msg">
                  Tiền thuế được đưa vào Quỹ Phòng Cứu Tế (Phòng Yêu Cầu).
                </div>
              </div>
            )}

            {/* 3. If landed on own property */}
            {!gameState.lastRentPayment && landedTile && ownerId === currentPlayer.id && (
              <div className="landed-receipt-card own-property magical-receipt">
                <div className="receipt-corner tl" />
                <div className="receipt-corner tr" />
                <div className="receipt-corner bl" />
                <div className="receipt-corner br" />
                <div className="receipt-split-body">
                  <div className="receipt-card-thumb-wrap">
                    <img
                      src={`${baseUrl}assets/cards/tile_${getTileAssetId(landedTile)}.webp`}
                      alt={landedTile.name}
                      className="receipt-card-thumb-img"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                    <div className="receipt-thumb-badge" style={{ background: '#059669' }}>🏰</div>
                  </div>
                  <div className="receipt-info-area">
                    <div className="receipt-header">
                      <span className="receipt-badge-own">Đất của bạn</span>
                      <span className="receipt-amount-safe">AN TOÀN</span>
                    </div>
                    <div className="receipt-tile-name">
                      {landedTile.icon} {landedTile.name}
                    </div>
                    <div className="receipt-status-msg">
                      Dừng chân an toàn tại bất động sản trực thuộc quyền sở hữu của bạn.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 4. If landed on Free Parking (Phòng Yêu Cầu) */}
            {!gameState.lastRentPayment && landedTile?.type === 'FREE_PARKING' && (
              <div className="landed-receipt-card free-parking magical-receipt">
                <div className="receipt-corner tl" />
                <div className="receipt-corner tr" />
                <div className="receipt-corner bl" />
                <div className="receipt-corner br" />
                <div className="receipt-header">
                  <span className="receipt-badge-pot">Phòng Yêu Cầu</span>
                </div>
                <div className="receipt-status-msg">
                  Nơi trú ẩn an toàn. Nhặt toàn bộ tiền tích lũy từ các loại thuế!
                </div>
              </div>
            )}

            <button
              className="btn-primary-roll"
              style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
              disabled={!isMyTurn}
              onClick={() => dispatch({ type: 'END_TURN' })}
            >
                            {gameState.consecutiveDoubles > 0
                ? <>Gieo tiếp (đôi #{gameState.consecutiveDoubles}) <kbd className="hpvn-key">Space</kbd></>
                : <>Kết thúc lượt <kbd className="hpvn-key">Space</kbd></>}
            </button>
          </div>
        )}

        {/* ============================================
            BANKRUPTCY PHASE: Player must mortgage/sell to pay debt
            ============================================ */}
        {gameState.turnPhase === 'BANKRUPTCY' && gameState.bankruptcyInfo && (() => {
          const debtor = gameState.players.find((p) => p.id === gameState.bankruptcyInfo?.debtorId) || currentPlayer;
          const isDebtorTurn = !myPlayerId || myPlayerId === debtor.id;

          if (!isDebtorTurn) {
            return (
              <div className="end-turn-action-box">
                <div className="landed-receipt-card tax-paid magical-receipt">
                  <div className="receipt-corner tl" /><div className="receipt-corner tr" />
                  <div className="receipt-corner bl" /><div className="receipt-corner br" />
                  <div className="receipt-header">
                    <span className="receipt-badge-rent">⚠️ CẢNH BÁO PHÁ SẢN ⚠️</span>
                  </div>
                  <div className="receipt-status-msg" style={{ color: '#f87171', textAlign: 'center' }}>
                    <strong>{debtor.name}</strong> cần thanh toán <strong>{gameState.bankruptcyInfo.amount} Galleons</strong><br/>
                    cho {gameState.bankruptcyInfo.reason}<br/>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                      ⏳ Đang đợi {debtor.name} {debtor.isAI ? '(Bot)' : ''} thế chấp tài sản hoặc bán nhà để trả nợ...
                    </span>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div className="end-turn-action-box">
              <div className="landed-receipt-card tax-paid magical-receipt">
                <div className="receipt-corner tl" /><div className="receipt-corner tr" />
                <div className="receipt-corner bl" /><div className="receipt-corner br" />
                <div className="receipt-header">
                  <span className="receipt-badge-rent">⚠️ CẢNH BÁO PHÁ SẢN ⚠️</span>
                </div>
                <div className="receipt-status-msg" style={{ color: '#f87171', textAlign: 'center' }}>
                  Bạn cần thanh toán <strong>{gameState.bankruptcyInfo.amount} Galleons</strong><br/>
                  cho {gameState.bankruptcyInfo.reason}<br/>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                    (Số dư hiện tại: {debtor.balance}G)
                  </span>
                </div>
              </div>

              {/* Tài sản có thể bán nhà */}
              {debtor.properties.some((propId) => {
                const tile = boardTiles.find((t) => t.id === propId);
                return tile && ((debtor.houses[propId] || 0) > 0 || (debtor.hotels[propId] || 0) > 0);
              }) && (
                <div style={{ marginTop: '12px' }}>
                  <div style={{ color: '#fbbf24', fontSize: '0.85rem', marginBottom: '6px' }}>
                    🏠 Nhà có thể BÁN:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {debtor.properties.map((propId) => {
                      const tile = boardTiles.find((t) => t.id === propId);
                      if (!tile) return null;
                      const houseCount = debtor.houses[propId] || 0;
                      const hotelCount = debtor.hotels[propId] || 0;
                      const refundAmount = Math.floor((tile.houseCost || 50) / 2);

                      if (hotelCount > 0) {
                        return (
                          <button
                            key={propId}
                            className="btn-fold"
                            style={{ fontSize: '0.7rem', padding: '6px 8px', flex: '1 1 45%' }}
                            onClick={() => dispatch({ type: 'SELL_HOUSE', propertyId: propId, playerId: debtor.id })}
                            title="Hạ cấp Lâu Đài về 4 Túp Lều để lấy tiền cứu nguy"
                          >
                            🏰 Hạ Lâu Đài (+{refundAmount}G)
                          </button>
                        );
                      }
                      if (houseCount > 0) {
                        return (
                          <button
                            key={propId}
                            className="btn-fold"
                            style={{ fontSize: '0.7rem', padding: '6px 8px', flex: '1 1 45%' }}
                            onClick={() => dispatch({ type: 'SELL_HOUSE', propertyId: propId, playerId: debtor.id })}
                            title={`Dỡ bớt 1 Túp Lều để nhận ${refundAmount}G (Hiện có ${houseCount} lều)`}
                          >
                            🏚️ Dỡ 1 lều (+{refundAmount}G) [{houseCount}]
                          </button>
                        );
                      }
                      return null;
                    })}
                  </div>
                </div>
              )}

              {/* Tài sản có thể thế chấp */}
              {debtor.properties.some((propId) => {
                const tile = boardTiles.find((t) => t.id === propId);
                return tile && tile.mortgageValue && !gameState.mortgagedProperties[propId];
              }) && (
                <div style={{ marginTop: '12px' }}>
                  <div style={{ color: '#34d399', fontSize: '0.85rem', marginBottom: '6px' }}>
                    📜 Tài sản có thể THẾ CHẤP:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {debtor.properties.map((propId) => {
                      const tile = boardTiles.find((t) => t.id === propId);
                      if (!tile || !tile.mortgageValue || gameState.mortgagedProperties[propId]) return null;

                      const mortCheck = canMortgageProperty(debtor, propId, gameState);

                      return (
                        <button
                          key={propId}
                          className="btn-bid"
                          disabled={!mortCheck.allowed}
                          style={{
                            fontSize: '0.7rem',
                            padding: '6px 8px',
                            flex: '1 1 45%',
                            opacity: mortCheck.allowed ? 1 : 0.45,
                            cursor: mortCheck.allowed ? 'pointer' : 'not-allowed',
                          }}
                          onClick={() => mortCheck.allowed && dispatch({ type: 'MORTGAGE_PROPERTY', propertyId: propId, playerId: debtor.id })}
                          title={mortCheck.allowed ? `Thế chấp nhận +${tile.mortgageValue}G` : mortCheck.reason}
                        >
                          📋 {tile.name.substring(0, 12)}... (+{tile.mortgageValue}G)
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tài sản đã thế chấp */}
              {debtor.properties.some((propId) => gameState.mortgagedProperties[propId]) && (
                <div style={{ marginTop: '12px' }}>
                  <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '6px' }}>
                    🔒 Đã thế chấp:
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                    {debtor.properties
                      .filter((propId) => gameState.mortgagedProperties[propId])
                      .map((propId) => {
                        const tile = boardTiles.find((t) => t.id === propId);
                        return tile ? tile.name : null;
                      })
                      .filter(Boolean)
                      .join(', ')}
                  </div>
                </div>
              )}

              {/* Nút hành động */}
              {debtor.balance >= (gameState.bankruptcyInfo?.amount || 0) ? (
                <button
                  className="btn-primary-roll"
                  style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', marginTop: '12px' }}
                  onClick={() => dispatch({ type: 'END_TURN' })}
                >
                  ✅ TRẢ NỢ VÀ TIẾP TỤC ({debtor.balance}G → {Math.max(0, debtor.balance - (gameState.bankruptcyInfo?.amount || 0))}G)
                </button>
              ) : (
                <div style={{ marginTop: '12px', fontSize: '0.75rem', color: '#fbbf24', textAlign: 'center' }}>
                  💡 Bạn cần thế chấp thêm tài sản hoặc bán nhà để đủ tiền trả nợ!
                </div>
              )}

              <button
                className="btn-pass-auction"
                style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', marginTop: '8px' }}
                onClick={() => setShowBankruptcyConfirm(true)}
              >
                💥 TUYÊN BỐ PHÁ SẢN
              </button>
            </div>
          );
        })()}

        {/* Quick Rule Footnote & Shortcut hints */}
        <div className="rules-tax-footnote">
          <span><kbd>Space</kbd> gieo · <kbd>B</kbd> mua · <kbd>P</kbd> đấu giá · <kbd>T</kbd> tốc 2x</span>
        </div>
      </div>
    );
  };

  const renderLeaderboard = () => (
    <div className="leaderboard-list">
      {leaderboard.map((player, idx) => {
        const isCurrent = player.id === currentPlayer?.id;
        return (
          <div
            key={player.id}
            className={`player-list-item ${isCurrent ? 'active-turn' : ''} ${
              player.isBankrupt ? 'bankrupt' : ''
            }`}
          >
            <div className={`leaderboard-rank ${idx === 0 ? 'top' : ''}`}>{idx + 1}</div>
            <div
              className="player-avatar-circle"
              style={{
                width: '32px',
                height: '32px',
                fontSize: '1rem',
                borderColor: player.color,
              }}
            >
              {player.tokenIcon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {player.name}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#bb9c7c' }}>
                {player.properties.length} ô đất {player.inJail ? '· Azkaban' : ''}
                {player.isAI && <span className="hpvn-bot">bot</span>}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 800, color: '#f3d189', fontSize: '0.85rem' }}>
                {g(player.netWorth)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderProperties = () => {
    if (!viewingPlayer) return null;

    return (
      <div>
        {/* Player Switcher Tabs */}
        {gameState.players.length > 1 && (
          <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '6px', marginBottom: '8px' }}>
            {gameState.players.map((p) => {
              const isSelected = p.id === viewingPlayer.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedPropertyPlayerId(p.id)}
                  style={{
                    background: isSelected ? 'rgba(243, 209, 137, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                    border: isSelected ? `1px solid ${p.color}` : '1px solid rgba(255, 255, 255, 0.1)',
                    color: isSelected ? '#f3d189' : '#bb9c7c',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {p.tokenIcon} {p.name.split(' ')[0]} · {p.properties.length}
                </button>
              );
            })}
          </div>
        )}

        {viewingPlayer.properties.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#8a7356', padding: '30px 10px', fontSize: '0.85rem' }}>
            {viewingPlayer.name} chưa sở hữu bất động sản nào.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {viewingPlayer.properties.map((propId) => {
              const tile = boardTiles.find((t) => t.id === propId);
              if (!tile) return null;
              const isMortgaged = !!gameState.mortgagedProperties[tile.id];
              const houseCount = viewingPlayer.houses[tile.id] || 0;
              const hasHotel = (viewingPlayer.hotels[tile.id] || 0) > 0;
              const houseCheck = canBuildHouse(viewingPlayer, tile.id, gameState);
              const hotelCheck = canBuildHotel(viewingPlayer, tile.id, gameState);
              const mortgageCheck = canMortgageProperty(viewingPlayer, tile.id, gameState);
              const unmortgageCheck = canUnmortgageProperty(viewingPlayer, tile.id, gameState);
              const style = tile.colorGroup ? COLOR_GROUP_STYLES[tile.colorGroup] : null;

              const isDebtor = gameState.turnPhase === 'BANKRUPTCY' && gameState.bankruptcyInfo?.debtorId === viewingPlayer.id;
              const canAct = (isMyTurn || isDebtor) && isControllingViewingPlayer;

              return (
                <div
                  key={tile.id}
                  style={{
                    background: 'rgba(28, 18, 10, 0.7)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '8px',
                    padding: '8px 10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.85rem', color: style?.bg || '#f3d189' }}>
                      {tile.icon} {tile.name}
                    </span>
                    {isMortgaged ? (
                      <span style={{ fontSize: '0.7rem', color: '#f87171', fontWeight: 700 }}>
                        ĐANG THẾ CHẤP
                      </span>
                    ) : hasHotel ? (
                      <span style={{ fontSize: '0.75rem', color: '#f3d189', fontWeight: 700 }}>
                        1 lâu đài
                      </span>
                    ) : houseCount > 0 ? (
                      <span style={{ fontSize: '0.75rem', color: '#f3d189', fontWeight: 600 }}>
                        {houseCount} túp lều
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.72rem', color: '#bb9c7c' }}>
                        Chưa xây nhà
                      </span>
                    )}
                    {/* Hiển thị lý do không thể xây nhà hoặc thế chấp */}
                    {!isMortgaged && houseCount === 0 && !houseCheck.allowed && houseCheck.reason && (
                      <span style={{
                        fontSize: '0.65rem',
                        color: '#f87171',
                        display: 'block',
                        marginTop: '2px'
                      }}>
                        ⚠️ {houseCheck.reason}
                      </span>
                    )}
                    {!isMortgaged && houseCount === 0 && !mortgageCheck.allowed && mortgageCheck.reason && houseCheck.allowed && (
                      <span style={{
                        fontSize: '0.65rem',
                        color: '#f87171',
                        display: 'block',
                        marginTop: '2px'
                      }}>
                        ⚠️ {mortgageCheck.reason}
                      </span>
                    )}
                    {!isMortgaged && houseCount === 0 && !canAct && (
                      <span style={{
                        fontSize: '0.65rem',
                        color: '#94a3b8',
                        display: 'block',
                        marginTop: '2px'
                      }}>
                        🔒 Chờ lượt của bạn
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {isMortgaged ? (
                      <button
                        className="btn-bid"
                        style={{ flex: 1 }}
                        disabled={!canAct || !unmortgageCheck.allowed}
                        onClick={() => dispatch({ type: 'UNMORTGAGE_PROPERTY', propertyId: tile.id, playerId: viewingPlayer.id })}
                        title={!canAct ? 'Chờ lượt của bạn' : (unmortgageCheck.reason || 'Chuộc lại bất động sản')}
                      >
                        Chuộc lại · {g(unmortgageCheck.cost ?? Math.floor((tile.mortgageValue || 50) * 1.1))}
                      </button>
                    ) : (
                      <>
                        {hasHotel ? (
                          <button
                            className="btn-fold"
                            style={{ flex: 1 }}
                            disabled={!canAct}
                            onClick={() => dispatch({ type: 'SELL_HOUSE', propertyId: tile.id, playerId: viewingPlayer.id })}
                            title="Hạ cấp lâu đài về 4 túp lều"
                          >
                            Hạ cấp lâu đài · +{g(Math.floor((tile.houseCost || 100) / 2))}
                          </button>
                        ) : houseCount >= 4 ? (
                          <>
                            <button
                              className="btn-bid"
                              style={{ flex: 1, background: 'linear-gradient(135deg, #d97706, #b45309)' }}
                              disabled={!canAct || !hotelCheck.allowed}
                              onClick={() => dispatch({ type: 'BUILD_HOTEL', propertyId: tile.id, playerId: viewingPlayer.id })}
                              title={hotelCheck.reason || 'Nâng cấp lên lâu đài Hogwarts'}
                            >
                              Lâu đài · {g(tile.houseCost)}
                            </button>
                            <button
                              className="btn-fold"
                              style={{ flex: 1 }}
                              disabled={!canAct}
                              onClick={() => dispatch({ type: 'SELL_HOUSE', propertyId: tile.id, playerId: viewingPlayer.id })}
                              title="Dỡ 1 túp lều"
                            >
                              Dỡ lều · +{g(Math.floor((tile.houseCost || 50) / 2))}
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              className="btn-bid"
                              style={{ flex: 1 }}
                              disabled={!canAct || !houseCheck.allowed}
                              onClick={() => dispatch({ type: 'BUILD_HOUSE', propertyId: tile.id, playerId: viewingPlayer.id })}
                              title={houseCheck.reason || 'Xây 1 túp lều'}
                            >
                              Xây lều · {g(tile.houseCost)}
                            </button>
                            {houseCount > 0 && (
                              <button
                                className="btn-fold"
                                style={{ flex: 1 }}
                                disabled={!canAct}
                                onClick={() => dispatch({ type: 'SELL_HOUSE', propertyId: tile.id, playerId: viewingPlayer.id })}
                                title="Dỡ 1 túp lều"
                              >
                                Dỡ lều · +{g(Math.floor((tile.houseCost || 50) / 2))}
                              </button>
                            )}
                          </>
                        )}
                        <button
                          className="btn-fold"
                          style={{ flex: 1 }}
                          disabled={!canAct || !mortgageCheck.allowed}
                          onClick={() => dispatch({ type: 'MORTGAGE_PROPERTY', propertyId: tile.id, playerId: viewingPlayer.id })}
                          title={!canAct ? 'Chờ lượt của bạn' : (mortgageCheck.reason || 'Thế chấp ô đất')}
                        >
                          Thế chấp · +{g(tile.mortgageValue)}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderEventLogs = () => {
    if (!viewingPlayer) return null;

    const relevantEvents = gameState.events.filter((evt) =>
      isEventRelevantToPlayer(evt, viewingPlayer, gameState.players)
    );

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Player Switcher Tabs */}
        {gameState.players.length > 1 && (
          <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '6px', marginBottom: '8px' }}>
            {gameState.players.map((p) => {
              const isSelected = p.id === viewingPlayer.id;
              const pCount = gameState.events.filter((e) => isEventRelevantToPlayer(e, p, gameState.players)).length;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedPropertyPlayerId(p.id)}
                  style={{
                    background: isSelected ? 'rgba(243, 209, 137, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                    border: isSelected ? `1px solid ${p.color}` : '1px solid rgba(255, 255, 255, 0.1)',
                    color: isSelected ? '#f3d189' : '#bb9c7c',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                  title={`Xem nhật ký của ${p.name}`}
                >
                  {p.tokenIcon} {p.name.split(' ')[0]} · {pCount}
                </button>
              );
            })}
          </div>
        )}

        {relevantEvents.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#8a7356', padding: '40px 10px', fontSize: '0.85rem' }}>
            Chưa có sự kiện nào liên quan đến {viewingPlayer.name}.
          </div>
        ) : (
          <div className="event-feed">
            {relevantEvents.slice(0, 50).map((evt) => (
              <div key={evt.id} className={`event-log-item ${evt.type}`}>
                {evt.message.replace(LEADING_EMOJI, '')}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderFinances = () => {
    // Strictly personal to the controlling player
    const targetPlayer = me;
    if (!targetPlayer) return null;

    const pf = gameState.playerFinances?.[targetPlayer.id] || {
      totalIncome: 0,
      totalExpense: 0,
      rentIncome: 0,
      rentExpense: 0,
      taxExpense: 0,
      landVisitsCount: 0,
    };
    const netCashflow = pf.totalIncome - pf.totalExpense;

    // List of properties owned by THIS PLAYER that have visitors / rent collected
    const visitedPropsList = targetPlayer.properties
      .map((propId) => {
        const tile = boardTiles.find((t) => t.id === propId);
        const stat = gameState.propertyRevenue?.[propId] || { totalRentCollected: 0, rentCount: 0 };
        return { propId, tile, stat };
      })
      .filter((item) => item.tile && item.stat.rentCount > 0)
      .sort((a, b) => b.stat.rentCount - a.stat.rentCount);

    const totalVisitsFromProps = visitedPropsList.reduce((sum, item) => sum + item.stat.rentCount, 0);
    const totalVisits = Math.max(pf.landVisitsCount || 0, totalVisitsFromProps);

    return (
      <div className="hpvn-finances-container">
        {/* Personal Player Identity Header */}
        <div className="hpvn-personal-finances-header">
          <div className="hpvn-player-badge" style={{ color: targetPlayer.color }}>
            <span className="player-token">{targetPlayer.tokenIcon}</span>
            <span className="player-name">{targetPlayer.name}</span>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
              ({HOUSE_INFO[targetPlayer.house]?.name || targetPlayer.house})
            </span>
          </div>
          <div style={{ flex: 1 }} />
          <span className="hpvn-finance-tag">Thu Chi Cá Nhân</span>
        </div>

        {/* HERO KPI CARDS: Tổng Thu, Tổng Chi, Dòng Tiền Ròng */}
        <div className="hpvn-finance-kpis">
          <div className="hpvn-finance-kpi-card is-income">
            <span className="kpi-label">Tổng Thu Vào</span>
            <span className="kpi-value">+{g(pf.totalIncome)}</span>
            <span className="kpi-sub">Tiền thuê: +{g(pf.rentIncome)}</span>
          </div>
          <div className="hpvn-finance-kpi-card is-expense">
            <span className="kpi-label">Tổng Chi Ra</span>
            <span className="kpi-value">−{g(pf.totalExpense)}</span>
            <span className="kpi-sub">Thuế/Phí: −{g(pf.taxExpense + pf.rentExpense)}</span>
          </div>
          <div className={`hpvn-finance-kpi-card ${netCashflow >= 0 ? 'is-positive' : 'is-negative'}`}>
            <span className="kpi-label">Dòng Tiền Ròng</span>
            <span className="kpi-value">
              {netCashflow >= 0 ? '+' : ''}{g(netCashflow)}
            </span>
            <span className="kpi-sub">{netCashflow >= 0 ? 'Thặng dư' : 'Thâm hụt'}</span>
          </div>
        </div>

        {/* SỐ LẦN CÓ NGƯỜI VÀO ĐẤT CỦA BẠN */}
        <div className="hpvn-land-visits-card">
          <div className="hpvn-land-visits-header">
            <div className="hpvn-land-visits-badge">
              <span>👣</span> SỐ LẦN CÓ NGƯỜI VÀO ĐẤT CỦA BẠN
            </div>
            <span className="hpvn-visits-count-pill">{totalVisits} lượt</span>
          </div>

          <div className="hpvn-land-visits-stats-grid">
            <div className="hpvn-visits-stat-box">
              <span className="stat-num is-gold">{totalVisits}</span>
              <span className="stat-lbl">Tổng lượt người vào đất</span>
            </div>
            <div className="hpvn-visits-stat-box">
              <span className="stat-num is-green">+{g(pf.rentIncome)}</span>
              <span className="stat-lbl">Tổng tiền thuê thu được</span>
            </div>
          </div>

          {/* Chi tiết các mảnh đất đã đón khách */}
          {visitedPropsList.length > 0 ? (
            <div className="hpvn-visited-props-list">
              <div className="hpvn-visited-props-title">Chi tiết các mảnh đất đã đón khách:</div>
              {visitedPropsList.map(({ propId, tile, stat }) => (
                <div key={propId} className="hpvn-visited-prop-row">
                  <div
                    className="hpvn-prop-color-dot"
                    style={{
                      background: COLOR_GROUP_STYLES[tile!.colorGroup || 'BROWN']?.bg || '#d97706',
                    }}
                  />
                  <span className="hpvn-visited-prop-name">{tile!.name}</span>
                  <div style={{ flex: 1 }} />
                  <span className="hpvn-visited-prop-count">{stat.rentCount} lượt vào</span>
                  <span className="hpvn-visited-prop-rent">+{g(stat.totalRentCollected)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="hpvn-visits-empty">
              <span>🏰 Chưa có đối thủ nào dừng chân tại các mảnh đất của bạn.</span>
              <span style={{ fontSize: '0.72rem', color: '#8a7356' }}>
                Khi người chơi khác đi vào đất của bạn, số lần ghé và tiền thuê sẽ hiển thị tại đây.
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* ========================================================
          1. DESKTOP SIDEBAR VIEW (Active on min-width: 901px)
          ======================================================== */}
      {/* ========================================================
          1. DESKTOP SIDEBAR VIEW (Active on min-width: 901px)
          ======================================================== */}
      <aside className={`right-sidebar right-sidebar-desktop hpvn-cmd ${isCollapsed ? 'is-collapsed' : ''}`}>
        {isCollapsed ? (
          <div className="hpvn-collapsed-rail">
            <button
              className="hpvn-rail-btn hpvn-rail-toggle"
              onClick={() => setIsCollapsed(false)}
              title="Mở rộng bảng điều khiển"
              aria-label="Mở rộng bảng điều khiển"
            >
              <Icon name="chevronRight" size={18} />
            </button>

            <div
              className={`hpvn-rail-turn-indicator ${isMyTurn ? 'is-my-turn' : ''}`}
              title={isMyTurn ? 'Lượt của bạn!' : `Lượt: ${currentPlayer?.name || ''}`}
              onClick={() => setIsCollapsed(false)}
            >
              <span
                className="player-avatar-circle mini-avatar"
                style={{ borderColor: currentPlayer?.color, background: `${currentPlayer?.color}22` }}
              >
                {currentPlayer?.tokenIcon}
              </span>
              {isMyTurn && <span className="hpvn-rail-dot" />}
            </div>

            <div className="hpvn-rail-divider" />

            <button
              className={`hpvn-rail-btn ${activeTab === 'leaderboard' ? 'is-active' : ''}`}
              onClick={() => { setActiveTab('leaderboard'); setIsCollapsed(false); }}
              title="Bảng xếp hạng"
              aria-label="Bảng xếp hạng"
            >
              <Icon name="trophy" size={16} />
            </button>

            <button
              className={`hpvn-rail-btn ${activeTab === 'properties' ? 'is-active' : ''}`}
              onClick={() => { setSelectedPropertyPlayerId(null); setActiveTab('properties'); setIsCollapsed(false); }}
              title={`Đất và nhà (${me?.properties.length || 0})`}
              aria-label="Đất và nhà"
            >
              <Icon name="land" size={16} />
              {me && me.properties.length > 0 && <span className="hpvn-rail-badge">{me.properties.length}</span>}
            </button>

            <button
              className={`hpvn-rail-btn ${activeTab === 'events' ? 'is-active' : ''}`}
              onClick={() => { setActiveTab('events'); setIsCollapsed(false); }}
              title="Nhật ký ván"
              aria-label="Nhật ký ván"
            >
              <Icon name="scroll" size={16} />
            </button>

            <button
              className={`hpvn-rail-btn ${activeTab === 'finances' ? 'is-active' : ''}`}
              onClick={() => { setActiveTab('finances'); setIsCollapsed(false); }}
              title="Sổ thu chi & Dòng tiền"
              aria-label="Sổ thu chi & Dòng tiền"
            >
              <Icon name="coins" size={16} />
            </button>

            <div className="hpvn-rail-spacer" />

            <button
              className="hpvn-rail-btn"
              onClick={toggleSound}
              title={muted ? 'Bật âm thanh' : 'Tắt âm thanh'}
              aria-label={muted ? 'Bật âm thanh' : 'Tắt âm thanh'}
            >
              <Icon name={muted ? 'soundOff' : 'soundOn'} size={15} />
            </button>

            <div className="hpvn-rail-timer" title={`Thời gian còn lại · Vòng ${gameState.turnNumber}`}>
              {timeFormatted}
            </div>
          </div>
        ) : (
          <>
            {/* Top bar: Collapse toggle, clock, then quick icon controls */}
            <header className="hpvn-cmd-top">
              <button
                className="hpvn-collapse-btn"
                onClick={() => setIsCollapsed(true)}
                title="Thu gọn bảng điều khiển để phóng to bàn cờ 3D"
                aria-label="Thu gọn"
              >
                <Icon name="chevronLeft" size={16} />
              </button>
              <span className={`hpvn-pill timer-pill ${timerClass}`} title={`Vòng ${gameState.turnNumber} · thời gian còn lại của ván (30 phút)`}>
                <Icon name="clock" size={13} />{timeFormatted}<span className="hpvn-pill-sub">V{gameState.turnNumber}</span>
              </span>
              {gameState.rentMultiplier > 1 && (
                <span className="hpvn-pill is-curse" title="Lời nguyền Hắc ám: tiền thuê và thuế tăng">x{gameState.rentMultiplier}</span>
              )}
              <div style={{ flex: 1 }} />
              <button className={`hpvn-pill hpvn-iconbtn ${gameState.turboMode ? 'is-on' : ''}`} disabled={!isHost}
                onClick={() => dispatch({ type: 'TOGGLE_TURBO' })} aria-pressed={gameState.turboMode}
                title={gameState.turboMode ? 'Siêu tốc đang bật (phím T)' : 'Bật siêu tốc 2x (phím T)'} aria-label="Siêu tốc">
                <Icon name="bolt" size={15} />
              </button>
              <button className="hpvn-pill hpvn-iconbtn" onClick={toggleSound} title={muted ? 'Bật âm thanh' : 'Tắt âm thanh'}
                aria-label={muted ? 'Bật âm thanh' : 'Tắt âm thanh'}>
                <Icon name={muted ? 'soundOff' : 'soundOn'} size={15} />
              </button>
              {onExit && (
                <button className="hpvn-pill hpvn-iconbtn hpvn-exit" onClick={() => setConfirmExit(true)} title="Thoát ván" aria-label="Thoát ván">
                  <Icon name="exit" size={15} />
                </button>
              )}
            </header>

            {(roomCode || phoneFloo) && (
              <div className="hpvn-cmd-room">
                {roomCode && (
                  <button className="room-badge" onClick={copyRoomCode} title="Chép mã phòng">
                    {copied ? 'Đã chép mã' : isSpectator ? `👁️ Khán giả · ${roomCode}` : `Phòng ${roomCode}`}
                  </button>
                )}
                {roomCode && (
                  <button
                    className="spectate-share-badge"
                    onClick={copySpectatorLink}
                    title="Sao chép link mời bạn bè xem trận đấu trực tiếp"
                  >
                    {copiedLink ? '✓ Đã chép link' : '👁️ Mời xem ván'}
                  </button>
                )}
                {phoneFloo && <button className="hpvn-floo-btn" onClick={openFloo}>Floo</button>}
              </div>
            )}

            {/* You: compact 1-card snapshot */}
            {me ? (
              <section className="hpvn-you hpvn-you-compact">
                <div className="player-avatar-circle" style={{ borderColor: me.color, background: `${me.color}22` }}>{me.tokenIcon}</div>
                <div className="hpvn-you-name">
                  <strong>{me.name}</strong>
                  <span>{me.house}{me.isBankrupt ? ' · phá sản' : me.inJail ? ' · Azkaban' : ''}</span>
                </div>
                <div className="hpvn-you-worth">
                  <strong>{g(me.netWorth)}</strong>
                  <span>tài sản</span>
                </div>
                <div className="hpvn-you-stats">
                  <div><b>{g(me.balance)}</b><span>tiền mặt</span></div>
                  <div><b>{me.properties.length} ô</b><span>đất</span></div>
                  <div><b>{myBuildings}</b><span>nhà</span></div>
                </div>
                <div className="hpvn-sets">
                  {colorSets.map((cs) => (
                    <i key={cs.g} title={`${cs.name}: ${cs.owned}/${cs.total}`}
                      style={{ background: `linear-gradient(90deg, ${cs.color} ${cs.frac * 100}%, rgba(255, 255, 255, 0.08) ${cs.frac * 100}%)` }} />
                  ))}
                </div>
              </section>
            ) : isSpectator ? (
              <section className="hpvn-you hpvn-you-compact hpvn-spectator-summary">
                <div className="player-avatar-circle" style={{ borderColor: '#60a5fa', background: 'rgba(96, 165, 250, 0.15)' }}>👁️</div>
                <div className="hpvn-you-name">
                  <strong style={{ color: '#93c5fd' }}>Khán giả quan sát</strong>
                  <span>Đang theo dõi trực tiếp</span>
                </div>
                <div className="hpvn-you-worth">
                  <strong style={{ color: '#f3d189' }}>{gameState.players.filter((p) => !p.isBankrupt).length}</strong>
                  <span>người chơi</span>
                </div>
                <div className="hpvn-you-stats">
                  <div><b>{gameState.turnNumber}</b><span>vòng đấu</span></div>
                  <div><b>{gameState.boardTiles?.length || 40} ô</b><span>bàn cờ</span></div>
                  <div><b>{gameState.events.length}</b><span>sự kiện</span></div>
                </div>
              </section>
            ) : null}

            {/* Turn Action Block: Chỉ hiện bảng hành động khi đến lượt của mình hoặc trong phiên đấu giá. Khi là lượt người khác, hiển thị thanh chờ gọn nhẹ không chiếm chỗ */}
            {currentPlayer && (
              isMyTurn ? (
                <section className="turn-action-card hpvn-act is-mine">
                  <div className="hpvn-act-head">
                    <div className="hpvn-act-title">
                      <span>
                        Lượt của bạn
                        {gameState.dice ? ` · ${gameState.dice.die1}+${gameState.dice.die2}` : ''}
                      </span>
                    </div>
                    {timerRing()}
                  </div>
                  {renderTurnActions(false)}
                </section>
              ) : gameState.turnPhase === 'AUCTION' && gameState.auction ? (
                <section className="turn-action-card hpvn-act is-auction">
                  <div className="hpvn-act-head">
                    <div className="hpvn-act-title">
                      <span>Đấu giá tài sản</span>
                    </div>
                    {timerRing()}
                  </div>
                  {renderTurnActions(false)}
                </section>
              ) : (
                <div className="hpvn-waiting-turn-bar" title={`Đang trong lượt của ${currentPlayer.name}`}>
                  <span
                    className="player-avatar-circle mini-avatar"
                    style={{ borderColor: currentPlayer.color, background: `${currentPlayer.color}22` }}
                  >
                    {currentPlayer.tokenIcon}
                  </span>
                  <span className="hpvn-waiting-turn-text">
                    Lượt của <strong>{currentPlayer.name}</strong>
                    {gameState.dice ? ` · ${gameState.dice.die1}+${gameState.dice.die2}` : ''}
                  </span>
                  <div style={{ flex: 1 }} />
                  {timerRing(20)}
                </div>
              )
            )}

            {/* Segmented Hogwarts Tabs */}
            <div className="hpvn-segmented-tabs" role="tablist">
              <button
                className={`hpvn-seg-tab ${activeTab === 'leaderboard' ? 'is-active' : ''}`}
                onClick={() => { setSelectedPropertyPlayerId(null); setActiveTab('leaderboard'); }}
                role="tab"
                aria-selected={activeTab === 'leaderboard'}
              >
                <Icon name="trophy" size={14} />
                <span>Bảng điểm</span>
              </button>
              <button
                className={`hpvn-seg-tab ${activeTab === 'properties' ? 'is-active' : ''}`}
                onClick={() => { setSelectedPropertyPlayerId(null); setActiveTab('properties'); }}
                role="tab"
                aria-selected={activeTab === 'properties'}
              >
                <Icon name="land" size={14} />
                <span>Đất & Nhà ({me?.properties.length || 0})</span>
              </button>
              <button
                className={`hpvn-seg-tab ${activeTab === 'events' ? 'is-active' : ''}`}
                onClick={() => { setSelectedPropertyPlayerId(null); setActiveTab('events'); }}
                role="tab"
                aria-selected={activeTab === 'events'}
              >
                <Icon name="scroll" size={14} />
                <span>Nhật ký ({myEventsCount})</span>
              </button>
              <button
                className={`hpvn-seg-tab ${activeTab === 'finances' ? 'is-active' : ''}`}
                onClick={() => { setSelectedPropertyPlayerId(null); setActiveTab('finances'); }}
                role="tab"
                aria-selected={activeTab === 'finances'}
              >
                <Icon name="coins" size={14} />
                <span>Thu chi</span>
              </button>
            </div>

            {/* Active Tab Content Area */}
            <section className="hpvn-list hpvn-list-tabbed">
              <div className="tab-content-area">
                {activeTab === 'leaderboard'
                  ? renderLeaderboard()
                  : activeTab === 'events'
                  ? renderEventLogs()
                  : activeTab === 'finances'
                  ? renderFinances()
                  : renderProperties()}
              </div>
            </section>

            {/* Quick recent event ticker when not on events tab */}
            {activeTab !== 'events' && recentEvents.length > 0 && (
              <button className="hpvn-recent hpvn-recent-compact" onClick={() => setActiveTab('events')} title="Xem đầy đủ nhật ký">
                <span className="hpvn-recent-label">Gần đây:</span>
                <span className="hpvn-recent-line">{recentEvents[0].message.replace(LEADING_EMOJI, '')}</span>
              </button>
            )}
          </>
        )}
      </aside>

      {/* ========================================================
          2. MOBILE HUD CONTAINER (Active on mobile portrait)
          ======================================================== */}
      <div className="mobile-hud-container">
        {/* Floating Top Status Bar */}
        <header className="mobile-top-bar hpvn-phone-top">
          <div className="hpvn-phone-row">
            <span className={`hpvn-pill timer-pill ${timerClass}`} title="Thời gian còn lại của ván">
              <Icon name="clock" size={14} />{timeFormatted}
            </span>
            {gameState.rentMultiplier > 1 && (
              <span className="hpvn-pill is-curse" title="Lời nguyền Hắc ám: tiền thuê và thuế tăng">x{gameState.rentMultiplier}</span>
            )}
            <span className="hpvn-phone-gap" />
            <button className={`hpvn-pill hpvn-iconbtn ${gameState.turboMode ? 'is-on' : ''}`} disabled={!isHost}
              onClick={() => dispatch({ type: 'TOGGLE_TURBO' })} aria-pressed={gameState.turboMode} aria-label="Siêu tốc 2x">
              <Icon name="bolt" size={16} />
            </button>
            <button className="hpvn-pill hpvn-iconbtn" onClick={toggleSound} aria-label={muted ? 'Bật âm thanh' : 'Tắt âm thanh'}>
              <Icon name={muted ? 'soundOff' : 'soundOn'} size={16} />
            </button>
            {onExit && (
              <button className="hpvn-pill hpvn-iconbtn hpvn-exit" onClick={() => setConfirmExit(true)} aria-label="Thoát ván">
                <Icon name="exit" size={16} />
              </button>
            )}
          </div>
          <div className="hpvn-strip" role="list" aria-label="Người chơi">
            {[...leaderboard].sort((a, b) => Number(b.id === me?.id) - Number(a.id === me?.id)).map((p) => (
              <button key={p.id} role="listitem" onClick={() => openDrawerWithTab('leaderboard')}
                className={`hpvn-strip-chip ${p.id === currentPlayer?.id ? 'is-turn' : ''} ${p.id === me?.id ? 'is-me' : ''} ${p.isBankrupt ? 'is-out' : ''}`}>
                <span className="player-avatar-circle mini-avatar" style={{ borderColor: p.color, background: `${p.color}22` }}>{p.tokenIcon}</span>
                <span>{p.id === me?.id ? <b>Bạn</b> : p.netWorth.toLocaleString('vi-VN')}</span>
              </button>
            ))}
          </div>
        </header>

        {/* Floating Bottom Thumb Action Dock */}
        <div className="mobile-bottom-dock">
          {/* Mini Turn Status */}
          {currentPlayer && (
            <div className="mobile-turn-status-bar">
              <div className="mobile-player-mini">
                <div
                  className="player-avatar-circle mini-avatar"
                  style={{ borderColor: currentPlayer.color, background: `${currentPlayer.color}22` }}
                >
                  {currentPlayer.tokenIcon}
                </div>
                <div className="mobile-player-info">
                  <span className="mobile-player-name">{currentPlayer.name}</span>
                  <span className="mobile-player-house">{currentPlayer.house} {currentPlayer.isAI && <span className="hpvn-bot">bot</span>}</span>
                </div>
              </div>

              {timerRing(32)}

              <div className="mobile-player-cash">{g(currentPlayer.balance)}</div>
            </div>
          )}

          {/* Action Decision Controls (Roll / Buy / Auction / End turn) */}
          <div className="mobile-action-controls-box">
            {renderTurnActions(true)}
          </div>

          {/* Bottom Quick Tabs & Camera Switcher Bar */}
          <div className="mobile-quick-tabs-bar">
            <button
              className={`mobile-tab-btn ${activeTab === 'properties' && isMobileDrawerOpen ? 'active' : ''}`}
              onClick={() => openDrawerWithTab('properties')}
            >
              <span className="tab-icon"><Icon name="land" /></span>
              <span className="tab-label">Đất đai · {viewingPlayer?.properties.length || 0}</span>
            </button>

            <button
              className={`mobile-tab-btn ${activeTab === 'events' && isMobileDrawerOpen ? 'active' : ''}`}
              onClick={() => openDrawerWithTab('events')}
            >
              <span className="tab-icon"><Icon name="scroll" /></span>
              <span className="tab-label">Nhật ký</span>
            </button>

            <button
              className={`mobile-tab-btn ${activeTab === 'finances' && isMobileDrawerOpen ? 'active' : ''}`}
              onClick={() => openDrawerWithTab('finances')}
            >
              <span className="tab-icon"><Icon name="coins" /></span>
              <span className="tab-label">Thu chi</span>
            </button>

            {phoneFloo && (
              <button className="mobile-tab-btn hpvn-floo-tab" onClick={openFloo} title="Mở Mạng Floo">
                <span className="tab-icon"><Icon name="flame" /></span>
                <span className="tab-label">Floo</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Expandable Bottom Sheet Drawer */}
        {isMobileDrawerOpen && (
          <>
            <div
              className="mobile-drawer-backdrop"
              onClick={() => setIsMobileDrawerOpen(false)}
            />
            <div className="mobile-drawer-sheet">
              <div className="mobile-drawer-handle-bar" onClick={() => setIsMobileDrawerOpen(false)}>
                <div className="mobile-drawer-pill" />
              </div>

              <div className="mobile-drawer-header">
                <div className="mobile-drawer-title">
                  {activeTab === 'leaderboard' && 'Xếp hạng'}
                  {activeTab === 'properties' && 'Đất đai'}
                  {activeTab === 'events' && 'Nhật ký ván'}
                  {activeTab === 'finances' && 'Sổ Thu Chi & Dòng Tiền'}
                </div>
                <button
                  className="mobile-drawer-close-btn"
                  onClick={() => setIsMobileDrawerOpen(false)}
                >
                  ✕
                </button>
              </div>

              {/* Tab Selector Inside Drawer */}
              <div className="sidebar-tabs mobile-drawer-tabs">
                <button
                  className={`tab-btn ${activeTab === 'leaderboard' ? 'active' : ''}`}
                  onClick={() => setActiveTab('leaderboard')}
                >
                  Xếp hạng · {gameState.players.filter((p) => !p.isBankrupt).length}
                </button>
                <button
                  className={`tab-btn ${activeTab === 'properties' ? 'active' : ''}`}
                  onClick={() => setActiveTab('properties')}
                >
                  Đất đai · {viewingPlayer?.properties.length || 0}
                </button>
                <button
                  className={`tab-btn ${activeTab === 'events' ? 'active' : ''}`}
                  onClick={() => setActiveTab('events')}
                >
                  Nhật ký
                </button>
                <button
                  className={`tab-btn ${activeTab === 'finances' ? 'active' : ''}`}
                  onClick={() => setActiveTab('finances')}
                >
                  Thu chi
                </button>
              </div>

              <div className="tab-content-area mobile-drawer-content">
                {activeTab === 'leaderboard' && renderLeaderboard()}
                {activeTab === 'properties' && renderProperties()}
                {activeTab === 'events' && renderEventLogs()}
                {activeTab === 'finances' && renderFinances()}
              </div>

              <div className="mobile-drawer-footer">
                <button
                  className="btn-mobile-close-drawer"
                  onClick={() => setIsMobileDrawerOpen(false)}
                >
                  Về bàn cờ
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {confirmExit && onExit && (
        <div className="hpvn-confirm-backdrop" onClick={() => setConfirmExit(false)}>
          <div className="hpvn-confirm" role="dialog" aria-modal="true" aria-labelledby="hpvn-exit-title" onClick={(e) => e.stopPropagation()}>
            <h2 id="hpvn-exit-title">{isSpectator ? 'Rời chế độ xem?' : (myPlayer?.isBankrupt ? 'Về sảnh chính?' : 'Thoát ván?')}</h2>
            <p>
              {isSpectator
                ? (isHost && myPlayer?.isBankrupt
                  ? 'Bạn sẽ quay lại sảnh chính. Trận đấu của các đối thủ còn lại vẫn tiếp tục diễn ra trong nền.'
                  : 'Bạn đang là khán giả theo dõi trận đấu. Rời đi sẽ đưa bạn trở lại Sảnh chính.')
                : myPlayer?.isBankrupt
                ? 'Bạn đã phá sản và dừng cuộc chơi. Rời về sảnh chính, trận đấu của các đối thủ còn lại vẫn tiếp tục bình thường.'
                : roomCode && stakeAtRisk > 0
                ? (isHost
                  ? `Bạn là chủ phòng: thoát sẽ đóng phòng, ván không có kết quả và mọi người được hoàn ${galleons(stakeAtRisk)}.`
                  : `Bạn sẽ rời phòng và mất ${galleons(stakeAtRisk)} tiền cược. Ván của những người còn lại vẫn tiếp tục.`)
                : roomCode
                ? 'Bạn sẽ rời phòng. Ván của những người còn lại vẫn tiếp tục.'
                : 'Ván được lưu và đồng hồ ván dừng lại. Quay lại để chơi tiếp; sau 30 phút không thao tác, ván tự đóng.'}
            </p>
            <div className="hpvn-confirm-actions">
              <button className="btn-bid" onClick={() => setConfirmExit(false)} autoFocus>Ở lại</button>
              <button className="btn-fold" onClick={() => { setConfirmExit(false); void onExit(); }}>{isSpectator ? 'Rời đi' : (myPlayer?.isBankrupt ? 'Về sảnh' : 'Thoát')}</button>
            </div>
          </div>
        </div>
      )}

      <BankruptcyConfirmModal
        isOpen={showBankruptcyConfirm}
        onCancel={() => setShowBankruptcyConfirm(false)}
        onConfirm={() => {
          setShowBankruptcyConfirm(false);
          dispatch({ type: 'DECLARE_BANKRUPTCY' });
        }}
        debtorName={
          (gameState.bankruptcyInfo?.debtorId
            ? gameState.players.find((p) => p.id === gameState.bankruptcyInfo?.debtorId)?.name
            : null) || currentPlayer?.name
        }
        debtAmount={gameState.bankruptcyInfo?.amount}
        creditorName={
          gameState.bankruptcyInfo?.creditorId
            ? gameState.players.find((p) => p.id === gameState.bankruptcyInfo?.creditorId)?.name
            : undefined
        }
      />
    </>
  );
};

export default RightSidebar;
