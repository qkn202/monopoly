import React from 'react';
import { BankruptcyDraft, Player } from '../core/types';
import { HOGWARTS_TILES, COLOR_GROUP_STYLES, HOUSE_INFO } from '../core/boardData';
import { galleons } from '../hpvn/money';
import './BankruptcyDraftModal.css';

interface BankruptcyDraftModalProps {
  draft: BankruptcyDraft;
  players: Player[];
  myPlayerId?: string | null;
  onSelectProperty: (propertyId: string) => void;
}

export const BankruptcyDraftModal: React.FC<BankruptcyDraftModalProps> = ({
  draft,
  players,
  myPlayerId,
  onSelectProperty,
}) => {
  const currentDrafterId = draft.draftOrder[draft.currentDraftIndex];
  const currentDrafter = players.find((p) => p.id === currentDrafterId);
  const drafterHouse = currentDrafter?.house ? HOUSE_INFO[currentDrafter.house] : null;

  // Local play: if no myPlayerId is set, any human turn is playable by the local player
  const isMyTurn = (!myPlayerId && !currentDrafter?.isAI) || (!!myPlayerId && myPlayerId === currentDrafterId);

  const debtor = players.find((p) => p.id === draft.debtorId);

  // Total remainder lands that will be sold to bank
  const remainingPicks = draft.draftOrder.length - draft.currentDraftIndex;
  const totalAvailableCount = draft.availablePropertyIds.length;
  const remainderCount = Math.max(0, totalAvailableCount - remainingPicks);

  return (
    <div className="draft-modal-backdrop">
      <div className="draft-modal-frame" onClick={(e) => e.stopPropagation()}>
        {/* Ornate Gilded Corner Brackets */}
        <div className="draft-corner-accent top-left" />
        <div className="draft-corner-accent top-right" />
        <div className="draft-corner-accent bottom-left" />
        <div className="draft-corner-accent bottom-right" />

        {/* Header */}
        <div className="draft-modal-header">
          <div className="draft-header-badge">
            <span>⚖️ Tòa án Pháp thuật · Chia đều tài sản</span>
          </div>
          <h2 className="draft-modal-title">Phân Chia Tài Sản Phá Sản</h2>
          <p className="draft-modal-subtitle">
            Phù thủy <strong>{draft.debtorName}</strong> đã phá sản! Toàn bộ đất đai được chia đều cho các Nhà còn lại.
            <br />
            <span style={{ color: '#f3d189', fontSize: '0.82rem' }}>
              🛡️ Thứ tự chọn ưu tiên Nhà có tổng tài sản thấp nhất trước (Cơ hội lội ngược dòng)
            </span>
          </p>
        </div>

        {/* Stepper Bar of Draft Turn Order */}
        <div className="draft-stepper-container">
          {draft.draftOrder.map((pid, idx) => {
            const p = players.find((pl) => pl.id === pid);
            const pHouse = p?.house ? HOUSE_INFO[p.house] : null;
            const isCompleted = idx < draft.currentDraftIndex;
            const isCurrent = idx === draft.currentDraftIndex;
            const historyPick = draft.history[idx];

            return (
              <div
                key={`${pid}-${idx}`}
                className={`draft-step-pill ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''}`}
                title={historyPick ? `${p?.name} đã chọn ${historyPick.propertyName}` : `Lượt của ${p?.name}`}
              >
                <span className="draft-step-icon">{isCompleted ? '✓' : pHouse?.token || '🧙'}</span>
                <span>
                  Lượt {idx + 1}: {p?.name || 'Phù thủy'}
                  {historyPick ? ` (${historyPick.propertyName})` : ''}
                </span>
              </div>
            );
          })}
        </div>

        {/* Active Turn Notification Banner */}
        <div className={`draft-turn-banner ${isMyTurn ? 'my-turn' : ''}`}>
          <div className="draft-turn-info">
            <span className="draft-turn-avatar">{drafterHouse?.token || '🧙'}</span>
            <div className="draft-turn-text">
              {isMyTurn ? (
                <>
                  <span>✨ </span>
                  <strong>ĐẾN LƯỢT BẠN!</strong> Hãy chọn 1 mảnh đất bạn muốn sở hữu bên dưới:
                </>
              ) : (
                <>
                  <span>⏳ Đang đợi </span>
                  <strong>{currentDrafter?.name || 'Người chơi'}</strong>{' '}
                  <span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>
                    ({currentDrafter?.isAI ? 'Bot tự động' : 'Người chơi'})
                  </span>{' '}
                  chọn đất...
                </>
              )}
            </div>
          </div>

          <div className={`draft-timer-box ${draft.timerSeconds <= 5 ? 'draft-timer-danger' : ''}`}>
            <span>⏱️</span>
            <span>{draft.timerSeconds}s</span>
          </div>
        </div>

        {/* Grid of Available Properties */}
        <div className="draft-grid-container">
          <div className="draft-properties-grid">
            {draft.availablePropertyIds.map((propId) => {
              const tile = HOGWARTS_TILES.find((t) => t.id === propId);
              if (!tile) return null;

              const style = tile.colorGroup ? COLOR_GROUP_STYLES[tile.colorGroup] : null;
              const colorBg = style?.bg || '#475569';
              const colorText = style?.text || '#ffffff';
              const groupName = style?.name || tile.type;

              return (
                <div key={propId} className="draft-property-card">
                  <div
                    className="draft-card-color-bar"
                    style={{ backgroundColor: colorBg, color: colorText }}
                  >
                    {groupName}
                  </div>

                  <div className="draft-card-body">
                    <div className="draft-card-title-row">
                      <span className="draft-card-icon">{tile.icon || '🏰'}</span>
                      <span className="draft-card-name">{tile.name}</span>
                    </div>

                    <div className="draft-card-stats">
                      <div className="draft-card-stat-line">
                        <span>Giá trị đất:</span>
                        <span className="value">{galleons(tile.price || 100)}</span>
                      </div>
                      <div className="draft-card-stat-line">
                        <span>Thuê cơ bản:</span>
                        <span className="value">{galleons(tile.baseRent || 10)}</span>
                      </div>
                      {tile.houseCost && (
                        <div className="draft-card-stat-line">
                          <span>Giá xây nhà:</span>
                          <span className="value">{galleons(tile.houseCost)}</span>
                        </div>
                      )}
                    </div>

                    <button
                      className={`draft-pick-btn ${isMyTurn ? 'active' : 'disabled'}`}
                      disabled={!isMyTurn}
                      onClick={() => isMyTurn && onSelectProperty(propId)}
                    >
                      {isMyTurn ? '✨ Chọn mảnh đất này' : 'Chờ đến lượt'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer info: Remainder liquidation & cash pool notice */}
        <div className="draft-modal-footer">
          <div className="draft-footer-cash-row">
            <div className="draft-footer-pool">
              💰 Quỹ tiền mặt gốc của {draft.debtorName}: <strong>{galleons(draft.initialCashPool)}</strong>
            </div>
            {remainderCount > 0 && (
              <div className="draft-footer-remainder">
                ⚖️ <strong>{remainderCount} đất lẻ</strong> không chia hết sẽ được bán cho Ngân hàng lấy 100% tiền mặt.
              </div>
            )}
          </div>
          <div style={{ color: '#64748b', fontSize: '0.74rem' }}>
            ℹ️ Sau khi hoàn tất tất cả lượt chọn, toàn bộ tiền mặt (tiền gốc + tiền bán đất lẻ) sẽ được chia đều ngay cho tất cả người chơi còn sống sót!
          </div>

          {draft.history.length > 0 && (
            <div className="draft-footer-history">
              <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Lịch sử đã chọn:</span>
              {draft.history.map((h, i) => (
                <div key={i} className="draft-history-tag">
                  <strong>{h.playerName}</strong> ➔ {h.propertyName}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
