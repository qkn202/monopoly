import React, { useState } from 'react';
import { GameState, GameAction } from '../core/types';
import { HOGWARTS_TILES, COLOR_GROUP_STYLES } from '../core/boardData';
import { determineLeaderboard, canBuildHouse, canBuildHotel } from '../core/rulesEngine';
import { soundManager } from '../audio/soundManager';
import { openFloo, usePhoneFloo } from '../hpvn/usePhoneFloo';
import { Icon } from '../hpvn/Icon';
import { useHudInsets } from '../hpvn/useHudInsets';
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
  onExit,
  stakeAtRisk = 0,
}) => {
  const [confirmExit, setConfirmExit] = useState(false);
  const phoneFloo = usePhoneFloo(true);
  useHudInsets();
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'properties' | 'events'>('leaderboard');
  const [copied, setCopied] = useState(false);
  const [selectedPropertyPlayerId, setSelectedPropertyPlayerId] = useState<string | null>(null);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const isMyTurn = myPlayerId ? currentPlayer?.id === myPlayerId : true;

  const myPlayer = myPlayerId ? gameState.players.find((p) => p.id === myPlayerId) : null;
  const viewingPlayerId = selectedPropertyPlayerId || myPlayer?.id || currentPlayer?.id;
  const viewingPlayer = gameState.players.find((p) => p.id === viewingPlayerId) || currentPlayer;
  const isControllingViewingPlayer = viewingPlayer?.id === (myPlayerId || currentPlayer?.id);

  const currentBidderId = gameState.auction?.active
    ? gameState.auction.activeBidders[gameState.auction.currentBidderIndex]
    : null;
  const currentBidder = currentBidderId
    ? gameState.players.find((p) => p.id === currentBidderId)
    : null;
  // Solo/hotseat: only a human seat bids from these buttons; bots bid through botAI.
  const isMyBidTurn = myPlayerId ? currentBidderId === myPlayerId : !!currentBidder && !currentBidder.isAI;
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

  const landedTile = currentPlayer ? HOGWARTS_TILES[currentPlayer.position] : null;
  const ownerId = landedTile ? gameState.propertyOwnership[landedTile.id] : undefined;
  const owner = ownerId ? gameState.players.find((p) => p.id === ownerId) : undefined;

  const [muted, setMuted] = useState(soundManager.getMuted());

  const toggleSound = () => {
    const isNowMuted = soundManager.toggleMute();
    setMuted(isNowMuted);
  };

  // "You" is the seat this screen controls; in solo that is the one human seat.
  const me = myPlayer || gameState.players.find((p) => !p.isAI) || currentPlayer;
  const myBuildings = me
    ? Object.values(me.houses).reduce((a, b) => a + b, 0) + Object.values(me.hotels).reduce((a, b) => a + b, 0)
    : 0;
  const colorSets = Object.keys(COLOR_GROUP_STYLES)
    .filter((g) => g !== 'STATION' && g !== 'UTILITY')
    .map((g) => {
      const tiles = HOGWARTS_TILES.filter((t) => t.colorGroup === g);
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

  const recentEvents = gameState.events.slice(0, 2);

  const openDrawerWithTab = (tab: 'leaderboard' | 'properties' | 'events') => {
    setActiveTab(tab);
    setIsMobileDrawerOpen(true);
  };

  // --- Sub-renderers ---
  const renderTurnActions = (isMobile = false) => {
    if (!currentPlayer) return null;

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
                  src={`${baseUrl}assets/cards/tile_${landedTile.index}.webp`}
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
                  src={`${baseUrl}assets/cards/tile_${landedTile.index}.webp`}
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
                  src={`${baseUrl}assets/cards/tile_${landedTile.index}.webp`}
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
                Giá cao nhất:{' '}
                <strong style={{ color: '#f3d189' }}>{galleons(gameState.auction.currentBid)}</strong>
              </div>
              <div style={{ fontSize: '0.78rem', color: '#bb9c7c' }}>
                {gameState.auction.highBidderId
                  ? `Dẫn đầu: ${gameState.players.find((p) => p.id === gameState.auction?.highBidderId)?.name}`
                  : 'Chưa ai ra giá'}
              </div>
            </div>

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
                        src={`${baseUrl}assets/cards/tile_${landedTile.index}.webp`}
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
                        src={`${baseUrl}assets/cards/tile_${landedTile.index}.webp`}
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
                      src={`${baseUrl}assets/cards/tile_${landedTile.index}.webp`}
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
        {gameState.turnPhase === 'BANKRUPTCY' && gameState.bankruptcyInfo && (
          <div className="end-turn-action-box">
            <div className="landed-receipt-card tax-paid magical-receipt">
              <div className="receipt-corner tl" />
              <div className="receipt-corner tr" />
              <div className="receipt-corner bl" />
              <div className="receipt-corner br" />
              <div className="receipt-header">
                <span className="receipt-badge-rent">⚠️ CẢNH BÁO PHÁ SẢN ⚠️</span>
              </div>
              <div className="receipt-status-msg" style={{ color: '#f87171', textAlign: 'center' }}>
                Bạn cần thanh toán <strong>{gameState.bankruptcyInfo.amount} Galleons</strong><br/>
                cho {gameState.bankruptcyInfo.reason}<br/>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                  (Số dư hiện tại: {currentPlayer?.balance}G)
                </span>
              </div>
            </div>

            <div className="bankruptcy-actions-info" style={{ margin: '12px 0', textAlign: 'center' }}>
              <div style={{ color: '#fbbf24', marginBottom: '8px' }}>
                💡 Hãy thế chấp tài sản hoặc bán nhà để trả nợ!
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                • Click vào tài sản trên bàn cờ để thế chấp<br/>
                • Sử dụng nút bên dưới để bán nhà
              </div>
            </div>

            {currentPlayer && currentPlayer.balance >= (gameState.bankruptcyInfo?.amount || 0) && (
              <button
                className="btn-primary-roll"
                style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', marginTop: '8px' }}
                onClick={() => {
                  // Pay the debt and exit bankruptcy phase
                  const amount = gameState.bankruptcyInfo!.amount;
                  const creditorId = gameState.bankruptcyInfo!.creditorId;
                  const updatedBalance = currentPlayer.balance - amount;
                  // This will be handled by the reducer checking if balance is sufficient
                  dispatch({ type: 'END_TURN' });
                }}
              >
                ✅ TRẢ NỢ VÀ TIẾP TỤC ({currentPlayer.balance}G → {Math.max(0, currentPlayer.balance - (gameState.bankruptcyInfo?.amount || 0))}G)
              </button>
            )}

            <button
              className="btn-pass-auction"
              style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', marginTop: '8px' }}
              onClick={() => dispatch({ type: 'DECLARE_BANKRUPTCY' })}
            >
              💥 TUYÊN BỐ PHÁ SẢN
            </button>
          </div>
        )}

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
              const tile = HOGWARTS_TILES.find((t) => t.id === propId);
              if (!tile) return null;
              const isMortgaged = !!gameState.mortgagedProperties[tile.id];
              const houseCount = viewingPlayer.houses[tile.id] || 0;
              const hasHotel = (viewingPlayer.hotels[tile.id] || 0) > 0;
              const houseCheck = canBuildHouse(viewingPlayer, tile.id, gameState);
              const hotelCheck = canBuildHotel(viewingPlayer, tile.id, gameState);
              const style = tile.colorGroup ? COLOR_GROUP_STYLES[tile.colorGroup] : null;

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
                  </div>

                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {isMortgaged ? (
                      <button
                        className="btn-bid"
                        style={{ flex: 1 }}
                        disabled={!isMyTurn || !isControllingViewingPlayer || viewingPlayer.balance < Math.floor((tile.mortgageValue || 50) * 1.1)}
                        onClick={() => dispatch({ type: 'UNMORTGAGE_PROPERTY', propertyId: tile.id, playerId: viewingPlayer.id })}
                      >
                        Chuộc lại · {g(Math.floor((tile.mortgageValue || 50) * 1.1))}
                      </button>
                    ) : (
                      <>
                        {hasHotel ? (
                          <button
                            className="btn-fold"
                            style={{ flex: 1 }}
                            disabled={!isMyTurn || !isControllingViewingPlayer}
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
                              disabled={!isMyTurn || !isControllingViewingPlayer || !hotelCheck.allowed}
                              onClick={() => dispatch({ type: 'BUILD_HOTEL', propertyId: tile.id, playerId: viewingPlayer.id })}
                              title={hotelCheck.reason || 'Nâng cấp lên lâu đài Hogwarts'}
                            >
                              Lâu đài · {g(tile.houseCost)}
                            </button>
                            <button
                              className="btn-fold"
                              style={{ flex: 1 }}
                              disabled={!isMyTurn || !isControllingViewingPlayer}
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
                              disabled={!isMyTurn || !isControllingViewingPlayer || !houseCheck.allowed}
                              onClick={() => dispatch({ type: 'BUILD_HOUSE', propertyId: tile.id, playerId: viewingPlayer.id })}
                              title={houseCheck.reason || 'Xây 1 túp lều'}
                            >
                              Xây lều · {g(tile.houseCost)}
                            </button>
                            {houseCount > 0 && (
                              <button
                                className="btn-fold"
                                style={{ flex: 1 }}
                                disabled={!isMyTurn || !isControllingViewingPlayer}
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
                          disabled={!isMyTurn || !isControllingViewingPlayer || houseCount > 0 || hasHotel}
                          onClick={() => dispatch({ type: 'MORTGAGE_PROPERTY', propertyId: tile.id, playerId: viewingPlayer.id })}
                          title={houseCount > 0 || hasHotel ? 'Cần bán hết nhà trước khi thế chấp' : ''}
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

  const renderEventLogs = () => (
    <div className="event-feed">
      {gameState.events.slice(0, 40).map((evt) => (
        <div key={evt.id} className={`event-log-item ${evt.type}`}>
          {evt.message.replace(LEADING_EMOJI, '')}
        </div>
      ))}
    </div>
  );

  return (
    <>
      {/* ========================================================
          1. DESKTOP SIDEBAR VIEW (Active on min-width: 901px)
          ======================================================== */}
      <aside className="right-sidebar right-sidebar-desktop hpvn-cmd">
        {/* Top bar: name, clock, round, then icon controls */}
        <header className="hpvn-cmd-top">
          <span className="game-logo-title">Cờ Tỷ Phú</span>
          <span className={`hpvn-pill timer-pill ${timerClass}`} title={`Vòng ${gameState.turnNumber} · thời gian còn lại của ván (30 phút)`}>
            <Icon name="clock" size={14} />{timeFormatted}<span className="hpvn-pill-sub">V{gameState.turnNumber}</span>
          </span>
          {gameState.rentMultiplier > 1 && (
            <span className="hpvn-pill is-curse" title="Lời nguyền Hắc ám: tiền thuê và thuế tăng">x{gameState.rentMultiplier}</span>
          )}
          <button className={`hpvn-pill hpvn-iconbtn ${gameState.turboMode ? 'is-on' : ''}`} disabled={!isHost}
            onClick={() => dispatch({ type: 'TOGGLE_TURBO' })} aria-pressed={gameState.turboMode}
            title={gameState.turboMode ? 'Siêu tốc đang bật (phím T)' : 'Bật siêu tốc 2x (phím T)'} aria-label="Siêu tốc">
            <Icon name="bolt" size={16} />
          </button>
          <button className="hpvn-pill hpvn-iconbtn" onClick={toggleSound} title={muted ? 'Bật âm thanh' : 'Tắt âm thanh'}
            aria-label={muted ? 'Bật âm thanh' : 'Tắt âm thanh'}>
            <Icon name={muted ? 'soundOff' : 'soundOn'} size={16} />
          </button>
          {onExit && (
            <button className="hpvn-pill hpvn-iconbtn hpvn-exit" onClick={() => setConfirmExit(true)} title="Thoát ván" aria-label="Thoát ván">
              <Icon name="exit" size={16} />
            </button>
          )}
        </header>
        {(roomCode || phoneFloo) && (
          <div className="hpvn-cmd-room">
            {roomCode && (
              <button className="room-badge" onClick={copyRoomCode} title="Chép mã phòng">
                {copied ? 'Đã chép mã' : `Phòng ${roomCode}`}
              </button>
            )}
            {phoneFloo && <button className="hpvn-floo-btn" onClick={openFloo}>Floo</button>}
          </div>
        )}

        {/* You: always this screen's seat, even while bots play */}
        {me && (
          <section className="hpvn-you">
            <div className="player-avatar-circle" style={{ borderColor: me.color, background: `${me.color}22` }}>{me.tokenIcon}</div>
            <div className="hpvn-you-name">
              <strong>{me.name}</strong>
              <span>{me.house}{me.isBankrupt ? ' · phá sản' : me.inJail ? ' · Azkaban' : ''}</span>
            </div>
            <div className="hpvn-you-worth">
              <strong>{g(me.netWorth)}</strong>
              <span>tổng tài sản</span>
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
        )}

        {/* One "what to do now" block */}
        {currentPlayer && (
          <section className={`turn-action-card hpvn-act ${isMyTurn ? 'is-mine' : ''}`}>
            <div className="hpvn-act-head">
              {!isMyTurn && (
                <div className="player-avatar-circle mini-avatar" style={{ borderColor: currentPlayer.color, background: `${currentPlayer.color}22` }}>
                  {currentPlayer.tokenIcon}
                </div>
              )}
              <div className="hpvn-act-title">
                <span>
                  {isMyTurn ? 'Lượt của bạn' : `Lượt của ${currentPlayer.name}`}
                  {gameState.dice ? ` · gieo ${gameState.dice.die1} + ${gameState.dice.die2}` : ''}
                </span>
              </div>
              {timerRing()}
            </div>
            {renderTurnActions(false)}
            <div className="hpvn-tools">
              <button className={activeTab === 'properties' ? 'is-active' : ''}
                onClick={() => { setSelectedPropertyPlayerId(null); setActiveTab(activeTab === 'properties' ? 'leaderboard' : 'properties'); }}>
                <Icon name="land" size={16} />Đất và nhà · {me?.properties.length || 0}
              </button>
              <button className={activeTab === 'events' ? 'is-active' : ''}
                onClick={() => setActiveTab(activeTab === 'events' ? 'leaderboard' : 'events')}>
                <Icon name="scroll" size={16} />Nhật ký
              </button>
            </div>
          </section>
        )}

        {/* Players (or the land / log panel the tools opened) */}
        <section className="hpvn-list">
          <div className="hpvn-list-head">
            <span>{activeTab === 'leaderboard' ? 'Người chơi' : activeTab === 'properties' ? 'Đất và nhà' : 'Nhật ký'}</span>
            {activeTab !== 'leaderboard' && (
              <button onClick={() => setActiveTab('leaderboard')}>Người chơi</button>
            )}
          </div>
          <div className="tab-content-area">
            {activeTab === 'leaderboard' && renderLeaderboard()}
            {activeTab === 'properties' && renderProperties()}
            {activeTab === 'events' && renderEventLogs()}
          </div>
        </section>

        {activeTab !== 'events' && recentEvents.length > 0 && (
          <button className="hpvn-recent" onClick={() => setActiveTab('events')} title="Xem nhật ký">
            <span className="hpvn-recent-label">Gần đây</span>
            {recentEvents.map((evt) => (
              <span key={evt.id} className="hpvn-recent-line">{evt.message.replace(LEADING_EMOJI, '')}</span>
            ))}
          </button>
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
              </div>

              <div className="tab-content-area mobile-drawer-content">
                {activeTab === 'leaderboard' && renderLeaderboard()}
                {activeTab === 'properties' && renderProperties()}
                {activeTab === 'events' && renderEventLogs()}
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
            <h2 id="hpvn-exit-title">Thoát ván?</h2>
            <p>
              {roomCode && stakeAtRisk > 0
                ? (isHost
                  ? `Bạn là chủ phòng: thoát sẽ đóng phòng, ván không có kết quả và mọi người được hoàn ${galleons(stakeAtRisk)}.`
                  : `Bạn sẽ rời phòng và mất ${galleons(stakeAtRisk)} tiền cược. Ván của những người còn lại vẫn tiếp tục.`)
                : roomCode
                ? 'Bạn sẽ rời phòng. Ván của những người còn lại vẫn tiếp tục.'
                : 'Ván được lưu và đồng hồ ván dừng lại. Quay lại để chơi tiếp; sau 30 phút không thao tác, ván tự đóng.'}
            </p>
            <div className="hpvn-confirm-actions">
              <button className="btn-bid" onClick={() => setConfirmExit(false)} autoFocus>Ở lại</button>
              <button className="btn-fold" onClick={() => { setConfirmExit(false); void onExit(); }}>Thoát</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default RightSidebar;
