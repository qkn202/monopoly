import React, { useState } from 'react';
import { GameState, GameAction } from '../core/types';
import { HOGWARTS_TILES, COLOR_GROUP_STYLES } from '../core/boardData';
import { determineLeaderboard, canBuildHouse, canBuildHotel } from '../core/rulesEngine';
import { soundManager } from '../audio/soundManager';
import './RightSidebar.css';

interface RightSidebarProps {
  gameState: GameState;
  dispatch: (action: GameAction) => void;
  roomCode?: string;
  myPlayerId?: string;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({
  gameState,
  dispatch,
  roomCode,
  myPlayerId,
}) => {
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
  const isMyBidTurn = myPlayerId ? currentBidderId === myPlayerId : isMyTurn;
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

  const cycleCameraPreset = () => {
    const current = (window as any).__cameraPreset || 'overview';
    const next = current === 'overview' ? 'follow' : current === 'follow' ? 'topdown' : 'overview';
    (window as any).__cameraPreset = next;
    if (typeof (window as any).__setCameraPreset === 'function') {
      (window as any).__setCameraPreset(next);
    }
  };

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
            {currentPlayer.inJail && (
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
            <button
              className="btn-primary-roll"
              disabled={!isMyTurn}
              onClick={() => dispatch({ type: 'ROLL_DICE' })}
            >
              <span>🎲</span> {isMyTurn ? 'GIEO XÚC XẮC [Space]' : `ĐANG CHỜ ${currentPlayer.name.toUpperCase()}...`}
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
                  src={`${baseUrl}assets/cards/tile_${landedTile.index}.jpg`}
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
                  <span className="tag-runes">⚡ ✦</span> THÂU TÓM CƯỠNG CHẾ <span className="tag-runes">✦ ⚡</span>
                </div>
                <div className="landed-tile-title">
                  {landedTile.name}
                </div>
                <div className="landed-tile-price">
                  Chủ hiện tại: <strong style={{ color: '#38bdf8' }}>{gameState.takeoverCandidate.ownerName}</strong>
                  <br />
                  Giá mua đứt (x2): <strong style={{ color: '#ffd700' }}>{gameState.takeoverCandidate.cost} Galleons</strong>
                  <br />
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontStyle: 'italic' }}>
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
                ⚡ Mua Đứt ({gameState.takeoverCandidate.cost}G) [B]
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
                  src={`${baseUrl}assets/cards/tile_${landedTile.index}.jpg`}
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
                  <span className="tag-runes">ᛟ ✦</span> NÂNG CẤP BẤT ĐỘNG SẢN <span className="tag-runes">✦ ᛟ</span>
                </div>
                <div className="landed-tile-title">
                  {landedTile.name}
                </div>
                <div className="landed-tile-price">
                  {gameState.upgradeCandidate.isHotelUpgrade ? (
                    <>
                      Đang có: <strong style={{ color: '#38bdf8' }}>4 Túp Lều</strong>
                      <br />
                      Lên cấp: <strong style={{ color: '#ffd700' }}>🏰 Lâu Đài Hogwarts (Tối Đa)</strong>
                    </>
                  ) : (
                    <>
                      Đang có:{' '}
                      <strong style={{ color: '#38bdf8' }}>
                        {gameState.upgradeCandidate.currentHouses > 0
                          ? `${gameState.upgradeCandidate.currentHouses} Túp Lều`
                          : 'Chưa có nhà'}
                      </strong>
                      <br />
                      Xây thêm: <strong style={{ color: '#ffd700' }}>🛖 Túp Lều thứ {gameState.upgradeCandidate.currentHouses + 1} / 4</strong>
                    </>
                  )}
                  <br />
                  Chi phí: <strong style={{ color: '#ffd700' }}>{gameState.upgradeCandidate.cost} Galleons</strong>
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
                  🏰 Lên Lâu Đài ({gameState.upgradeCandidate.cost}G) [B]
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
                  🛖 Xây Lều ({gameState.upgradeCandidate.cost}G) [B]
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
                  src={`${baseUrl}assets/cards/tile_${landedTile.index}.jpg`}
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
                  <span className="tag-runes">ᛟ ✦</span> CƠ HỘI MUA ĐẤT <span className="tag-runes">✦ ᛟ</span>
                </div>
                <div className="landed-tile-title">
                  {landedTile.name}
                </div>
                <div className="landed-tile-price">
                  Giá mua: <strong style={{ color: '#ffd700' }}>{landedTile.price} Galleons</strong>
                  <br />
                  Tiền thuê:{' '}
                  <strong style={{ color: gameState.rentMultiplier > 1 ? '#f87171' : '#cbd5e1' }}>
                    {(landedTile.baseRent || 0) * (gameState.rentMultiplier || 1)}G
                  </strong>
                  {gameState.rentMultiplier > 1 && (
                    <span className="curse-badge-small">
                      (x{gameState.rentMultiplier} ☠️)
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
                📜 Mua ({landedTile.price}G) [B]
              </button>
              <button
                className="btn-pass-auction"
                disabled={!isMyTurn}
                onClick={() => dispatch({ type: 'PASS_PROPERTY' })}
              >
                🔨 Đấu Giá [P]
              </button>
            </div>
          </div>
        )}

        {gameState.turnPhase === 'AUCTION' && gameState.auction && (
          <div className="auction-box">
            <div className="auction-title-row">
              <div className="auction-title">🔨 ĐẤU GIÁ CÔNG KHAI</div>
              <div className="auction-countdown">{gameState.auction.timerSeconds}s</div>
            </div>
            <div className="auction-bid-row">
              <div>
                Giá cao nhất:{' '}
                <strong style={{ color: '#ffd700' }}>{gameState.auction.currentBid} Galleons</strong>
              </div>
              <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                {gameState.auction.highBidderId
                  ? `Dẫn đầu: ${gameState.players.find((p) => p.id === gameState.auction?.highBidderId)?.name}`
                  : 'Chưa ai ra giá'}
              </div>
            </div>

            <div style={{ margin: '6px 0', fontSize: '0.8rem', textAlign: 'center' }}>
              {isMyBidTurn ? (
                <strong style={{ color: '#38bdf8' }}>👉 ĐẾN LƯỢT BẠN RA GIÁ!</strong>
              ) : (
                <span style={{ color: '#94a3b8' }}>
                  ⏳ Đang chờ <strong>{currentBidder?.name || 'người chơi'}</strong> ra giá...
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
                +25 G
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
                +50 G
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
                +100 G
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
                        src={`${baseUrl}assets/cards/tile_${landedTile.index}.jpg`}
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
                      <span className="receipt-badge-rent">✦ BIÊN LAI TIỀN THUÊ GRINGOTTS ✦</span>
                      <span className="receipt-amount-neg">-{gameState.lastRentPayment.amount} G</span>
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
                        <strong style={{ color: gameState.players.find((p) => p.id === gameState.lastRentPayment?.creditorId)?.color || '#ffd700' }}>
                          {gameState.players.find((p) => p.id === gameState.lastRentPayment?.creditorId)?.name}
                        </strong>
                      </div>
                      {gameState.rentMultiplier > 1 && (
                        <div className="receipt-line" style={{ color: '#f87171' }}>
                          <span>Hiệu ứng:</span>
                          <strong>Đã x{gameState.rentMultiplier} do Lời Nguyền Hắc Ám ☠️</strong>
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
                        src={`${baseUrl}assets/cards/tile_${landedTile.index}.jpg`}
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
                      <span className="receipt-badge-tax">✦ TRÁT THU THUẾ BỘ PHÁP THUẬT ✦</span>
                      <span className="receipt-amount-neg">-{gameState.lastRentPayment.amount} G</span>
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
                        <strong style={{ color: '#ffd700' }}>{gameState.freeParkingPot} Galleons</strong>
                      </div>
                      {gameState.rentMultiplier > 1 && (
                        <div className="receipt-line" style={{ color: '#c084fc' }}>
                          <span>Hiệu ứng:</span>
                          <strong>Đã x{gameState.rentMultiplier} do Lời Nguyền Hắc Ám ☠️</strong>
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
                      src={`${baseUrl}assets/cards/tile_${landedTile.index}.jpg`}
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
                      <span className="receipt-badge-own">✦ BẤT ĐỘNG SẢN CỦA BẠN ✦</span>
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
                  <span className="receipt-badge-pot">🎉 PHÒNG YÊU CẦU • SAFE HAVEN</span>
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
              <span>{gameState.consecutiveDoubles > 0 ? '🎲' : '➡️'}</span>{' '}
              {gameState.consecutiveDoubles > 0
                ? `GIEO TIẾP [Space] (ĐƯỢC ĐÔI #${gameState.consecutiveDoubles})`
                : 'KẾT THÚC LƯỢT [Space]'}
            </button>
          </div>
        )}

        {/* Quick Rule Footnote & Shortcut hints */}
        <div className="rules-tax-footnote">
          <span>⚡ <strong>Phím tắt:</strong> [Space] Gieo/Xong • [B] Mua • [P] Đấu giá • [T] Siêu Tốc 2x</span>
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
            <div className={`leaderboard-rank ${idx === 0 ? 'top' : ''}`}>#{idx + 1}</div>
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
                {player.name} {player.isAI ? '🤖' : ''}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                {player.properties.length} ô đất {player.inJail ? '• ⛓️ Azkaban' : ''}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 800, color: '#ffd700', fontSize: '0.85rem' }}>
                {player.netWorth.toLocaleString()} G
              </div>
              <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                Tiền mặt: {player.balance.toLocaleString()}
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
                    background: isSelected ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                    border: isSelected ? `1px solid ${p.color}` : '1px solid rgba(255, 255, 255, 0.1)',
                    color: isSelected ? '#ffd700' : '#94a3b8',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {p.tokenIcon} {p.name.split(' ')[0]} ({p.properties.length})
                </button>
              );
            })}
          </div>
        )}

        {viewingPlayer.properties.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#64748b', padding: '30px 10px', fontSize: '0.85rem' }}>
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
                    background: 'rgba(15, 23, 42, 0.7)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '8px',
                    padding: '8px 10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.85rem', color: style?.bg || '#ffd700' }}>
                      {tile.icon} {tile.name}
                    </span>
                    {isMortgaged ? (
                      <span style={{ fontSize: '0.7rem', color: '#f87171', fontWeight: 700 }}>
                        ĐANG THẾ CHẤP
                      </span>
                    ) : hasHotel ? (
                      <span style={{ fontSize: '0.75rem', color: '#ffd700', fontWeight: 700 }}>
                        🏰 1 Lâu Đài
                      </span>
                    ) : houseCount > 0 ? (
                      <span style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 600 }}>
                        🛖 {houseCount} Túp lều
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
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
                        onClick={() => dispatch({ type: 'UNMORTGAGE_PROPERTY', propertyId: tile.id })}
                      >
                        Chuộc lại ({Math.floor((tile.mortgageValue || 50) * 1.1)}G)
                      </button>
                    ) : (
                      <>
                        {hasHotel ? (
                          <button
                            className="btn-fold"
                            style={{ flex: 1 }}
                            disabled={!isMyTurn || !isControllingViewingPlayer}
                            onClick={() => dispatch({ type: 'SELL_HOUSE', propertyId: tile.id, playerId: viewingPlayer.id })}
                            title="Hạ cấp Lâu Đài về 4 Túp lều"
                          >
                            Hạ cấp Lâu Đài (+{Math.floor((tile.houseCost || 100) / 2)}G)
                          </button>
                        ) : houseCount >= 4 ? (
                          <>
                            <button
                              className="btn-bid"
                              style={{ flex: 1, background: 'linear-gradient(135deg, #d97706, #b45309)' }}
                              disabled={!isMyTurn || !isControllingViewingPlayer || !hotelCheck.allowed}
                              onClick={() => dispatch({ type: 'BUILD_HOTEL', propertyId: tile.id, playerId: viewingPlayer.id })}
                              title={hotelCheck.reason || 'Nâng cấp lên Lâu Đài Hogwarts'}
                            >
                              🏰 Lâu Đài ({tile.houseCost}G)
                            </button>
                            <button
                              className="btn-fold"
                              style={{ flex: 1 }}
                              disabled={!isMyTurn || !isControllingViewingPlayer}
                              onClick={() => dispatch({ type: 'SELL_HOUSE', propertyId: tile.id, playerId: viewingPlayer.id })}
                              title="Dỡ 1 Túp lều"
                            >
                              Dỡ lều (+{Math.floor((tile.houseCost || 50) / 2)}G)
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              className="btn-bid"
                              style={{ flex: 1 }}
                              disabled={!isMyTurn || !isControllingViewingPlayer || !houseCheck.allowed}
                              onClick={() => dispatch({ type: 'BUILD_HOUSE', propertyId: tile.id, playerId: viewingPlayer.id })}
                              title={houseCheck.reason || 'Xây 1 Túp lều'}
                            >
                              Xây lều ({tile.houseCost}G)
                            </button>
                            {houseCount > 0 && (
                              <button
                                className="btn-fold"
                                style={{ flex: 1 }}
                                disabled={!isMyTurn || !isControllingViewingPlayer}
                                onClick={() => dispatch({ type: 'SELL_HOUSE', propertyId: tile.id, playerId: viewingPlayer.id })}
                                title="Dỡ 1 Túp lều"
                              >
                                Dỡ lều (+{Math.floor((tile.houseCost || 50) / 2)}G)
                              </button>
                            )}
                          </>
                        )}
                        <button
                          className="btn-fold"
                          style={{ flex: 1 }}
                          disabled={!isMyTurn || !isControllingViewingPlayer || houseCount > 0 || hasHotel}
                          onClick={() => dispatch({ type: 'MORTGAGE_PROPERTY', propertyId: tile.id })}
                          title={houseCount > 0 || hasHotel ? 'Cần bán hết nhà trước khi thế chấp' : ''}
                        >
                          Thế chấp (+{tile.mortgageValue}G)
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
          {evt.message}
        </div>
      ))}
    </div>
  );

  return (
    <>
      {/* ========================================================
          1. DESKTOP SIDEBAR VIEW (Active on min-width: 901px)
          ======================================================== */}
      <aside className="right-sidebar right-sidebar-desktop">
        {/* Header with Game Title, Room Code, and Timer */}
        <div className="sidebar-header">
          <div className="header-top-row">
            <div className="game-logo-title">
              <span>⚡</span> HOGWARTS 3D
            </div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <button
                className="sound-toggle-btn"
                onClick={toggleSound}
                title={muted ? 'Bật âm thanh' : 'Tắt âm thanh'}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: muted ? '#94a3b8' : '#38bdf8',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {muted ? '🔇 Tắt' : '🔊 Bật'}
              </button>
              {roomCode && (
                <button className="room-badge" onClick={copyRoomCode} title="Nhấn để copy mã phòng (Máy chủ Supabase Realtime)">
                  <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', marginRight: '4px', boxShadow: '0 0 6px #10b981' }} />
                  {copied ? 'ĐÃ COPY MÃ!' : `PHÒNG: ${roomCode}`}
                </button>
              )}
            </div>
          </div>

          <div className="header-status-bar">
            <div className={`timer-pill ${timerClass}`} title="Thời gian toàn trận (tối đa 30 phút)">
              <span>⏳</span>
              <span>{timeFormatted}</span>
            </div>
            <div className={`turn-timer-pill ${turnTimerClass}`} title="Thời gian suy nghĩ lượt này (tối đa 1 phút)">
              <span>⏱️</span>
              <span className="turn-timer-num">{turnSec}s</span>
            </div>
            <div className="round-pill">VÒNG {gameState.turnNumber}</div>
            {gameState.rentMultiplier > 1 && (
              <div
                className="curse-multiplier-pill pulse-fast"
                title="Bão Lời Nguyền Hắc Ám: Toàn bộ tiền thuê đất & thuế đã bị nhân đôi!"
              >
                <span>☠️</span>
                <span>THUẾ &amp; THUÊ X{gameState.rentMultiplier}</span>
              </div>
            )}
            <button
              className={`turbo-toggle-btn ${gameState.turboMode ? 'active' : ''}`}
              onClick={() => dispatch({ type: 'TOGGLE_TURBO' })}
              title="Bật/Tắt chế độ Siêu Tốc 2x (Phím T) — Bot đi nhanh, quân cờ lướt nhanh, đấu giá 4s"
            >
              <span>⚡</span>
              <span>{gameState.turboMode ? '2X' : '1X'}</span>
            </button>
          </div>
        </div>

        {/* Turn Action Card (Current Player Controls) */}
        {currentPlayer && (
          <div className="turn-action-card">
            <div className="player-turn-header">
              <div
                className="player-avatar-circle"
                style={{ borderColor: currentPlayer.color, background: `${currentPlayer.color}22` }}
              >
                {currentPlayer.tokenIcon}
              </div>
              <div className="player-turn-meta">
                <div className="player-turn-name">{currentPlayer.name}</div>
                <div className="player-turn-house">
                  {currentPlayer.house} {currentPlayer.isAI ? '🤖' : ''}
                </div>
              </div>
              <div className="player-turn-balance">{currentPlayer.balance.toLocaleString()} G</div>
            </div>

            {/* 1-Minute Turn Countdown Progress Bar */}
            <div className="turn-timer-track" title={`Thời gian lượt đi còn lại: ${turnSec}s`}>
              <div
                className={`turn-timer-fill ${turnTimerClass}`}
                style={{ width: `${Math.max(0, Math.min(100, (turnSec / 60) * 100))}%` }}
              />
            </div>

            {/* Dice Results Display */}
            {gameState.dice && (
              <div className="dice-result-box">
                <div className="dice-die-face">{gameState.dice.die1}</div>
                <div className="dice-die-face">{gameState.dice.die2}</div>
              </div>
            )}

            {renderTurnActions(false)}
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="sidebar-tabs">
          <button
            className={`tab-btn ${activeTab === 'leaderboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('leaderboard')}
          >
            🏆 XẾP HẠNG ({gameState.players.filter((p) => !p.isBankrupt).length})
          </button>
          <button
            className={`tab-btn ${activeTab === 'properties' ? 'active' : ''}`}
            onClick={() => setActiveTab('properties')}
          >
            🏰 ĐẤT ĐAI ({viewingPlayer?.properties.length || 0})
          </button>
          <button
            className={`tab-btn ${activeTab === 'events' ? 'active' : ''}`}
            onClick={() => setActiveTab('events')}
          >
            📜 NHẬT KÝ
          </button>
        </div>

        {/* Tab Content Panels */}
        <div className="tab-content-area">
          {activeTab === 'leaderboard' && renderLeaderboard()}
          {activeTab === 'properties' && renderProperties()}
          {activeTab === 'events' && renderEventLogs()}
        </div>
      </aside>

      {/* ========================================================
          2. MOBILE HUD CONTAINER (Active on mobile portrait)
          ======================================================== */}
      <div className="mobile-hud-container">
        {/* Floating Top Status Bar */}
        <header className="mobile-top-bar">
          <div className="mobile-top-left">
            <span className="mobile-logo-bolt">⚡</span>
            <span className="mobile-logo-text">HOGWARTS 3D</span>
            <button
              className="sound-toggle-btn mobile-sound-btn"
              onClick={toggleSound}
              title={muted ? 'Bật âm thanh' : 'Tắt âm thanh'}
            >
              {muted ? '🔇' : '🔊'}
            </button>
          </div>

          <div className="mobile-top-center">
            <div className={`timer-pill ${timerClass}`}>
              <span>⏱️</span>
              <span>{timeFormatted}</span>
            </div>
            <div className="round-pill">V{gameState.turnNumber}</div>
            {gameState.rentMultiplier > 1 && (
              <div className="mobile-curse-pill" title="Tiền thuê & thuế x2">
                ☠️ x{gameState.rentMultiplier}
              </div>
            )}
            <button
              className={`mobile-turbo-pill ${gameState.turboMode ? 'active' : ''}`}
              onClick={() => dispatch({ type: 'TOGGLE_TURBO' })}
              title="Chế độ Siêu Tốc 2x (Phím T)"
            >
              ⚡ {gameState.turboMode ? '2x' : '1x'}
            </button>
          </div>

          <div className="mobile-top-right">
            <button
              className="mobile-quick-wallet-btn"
              onClick={() => openDrawerWithTab('properties')}
              title="Mở Quản lý đất đai & tài sản"
            >
              <span className="wallet-gold">
                🪙 {myPlayer ? `${myPlayer.balance.toLocaleString()}G` : `${currentPlayer?.balance.toLocaleString()}G`}
              </span>
              <span className="wallet-arrow">▾</span>
            </button>
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
                  <span className="mobile-player-house">{currentPlayer.house} {currentPlayer.isAI ? '🤖' : ''}</span>
                </div>
              </div>

              {gameState.dice && (
                <div className="mobile-dice-mini">
                  <div className="dice-die-face mini">{gameState.dice.die1}</div>
                  <div className="dice-die-face mini">{gameState.dice.die2}</div>
                </div>
              )}

              <div className={`mobile-turn-countdown ${turnTimerClass}`} title="Thời gian lượt đi (1 phút)">
                <span>⏱️</span>
                <span>{turnSec}s</span>
              </div>

              <div className="mobile-player-cash">{currentPlayer.balance.toLocaleString()} G</div>
            </div>
          )}

          {/* Action Decision Controls (Roll / Buy / Auction / End turn) */}
          <div className="mobile-action-controls-box">
            {renderTurnActions(true)}
          </div>

          {/* Bottom Quick Tabs & Camera Switcher Bar */}
          <div className="mobile-quick-tabs-bar">
            <button
              className={`mobile-tab-btn ${activeTab === 'leaderboard' && isMobileDrawerOpen ? 'active' : ''}`}
              onClick={() => openDrawerWithTab('leaderboard')}
            >
              <span className="tab-icon">🏆</span>
              <span className="tab-label">Xếp Hạng</span>
            </button>

            <button
              className={`mobile-tab-btn ${activeTab === 'properties' && isMobileDrawerOpen ? 'active' : ''}`}
              onClick={() => openDrawerWithTab('properties')}
            >
              <span className="tab-icon">🏰</span>
              <span className="tab-label">Đất Đai ({viewingPlayer?.properties.length || 0})</span>
            </button>

            <button
              className={`mobile-tab-btn ${activeTab === 'events' && isMobileDrawerOpen ? 'active' : ''}`}
              onClick={() => openDrawerWithTab('events')}
            >
              <span className="tab-icon">📜</span>
              <span className="tab-label">Nhật Ký</span>
            </button>

            <button
              className="mobile-tab-btn mobile-camera-btn"
              onClick={cycleCameraPreset}
              title="Đổi góc nhìn 3D"
            >
              <span className="tab-icon">🎥</span>
              <span className="tab-label">Góc Nhìn</span>
            </button>
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
                  {activeTab === 'leaderboard' && '🏆 BẢNG XẾP HẠNG PHÁP SƯ'}
                  {activeTab === 'properties' && '🏰 QUẢN LÝ ĐẤT ĐAI & NHÀ'}
                  {activeTab === 'events' && '📜 NHẬT KÝ VÁN ĐẤU'}
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
                  🏆 XẾP HẠNG ({gameState.players.filter((p) => !p.isBankrupt).length})
                </button>
                <button
                  className={`tab-btn ${activeTab === 'properties' ? 'active' : ''}`}
                  onClick={() => setActiveTab('properties')}
                >
                  🏰 ĐẤT ĐAI ({viewingPlayer?.properties.length || 0})
                </button>
                <button
                  className={`tab-btn ${activeTab === 'events' ? 'active' : ''}`}
                  onClick={() => setActiveTab('events')}
                >
                  📜 NHẬT KÝ
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
                  Trở Về Bàn Cờ 3D
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default RightSidebar;
