import React, { useEffect } from 'react';
import { BankruptcyDetails } from '../core/types';
import { soundManager } from '../audio/soundManager';
import { galleons } from '../hpvn/money';
import './DefeatHowlerModal.css';

interface DefeatHowlerModalProps {
  details: BankruptcyDetails;
  isGameOver?: boolean;
  onSpectate: () => void;
  onLeave: () => void;
  onRestart?: () => void;
}

export const DefeatHowlerModal: React.FC<DefeatHowlerModalProps> = ({
  details,
  isGameOver = false,
  onSpectate,
  onLeave,
  onRestart,
}) => {
  // Trigger procedural audio on mount
  useEffect(() => {
    soundManager.playDefeatHowler();
  }, []);

  return (
    <div className="howler-modal-backdrop" onClick={(e) => e.stopPropagation()}>
      <div className="howler-envelope-card">
        {/* Floating Smoke & Embers */}
        <div className="howler-smoke-fx">
          <span>🔥</span>
          <span>💨</span>
          <span>🔥</span>
        </div>

        {/* Wax Seal Header */}
        <div className="howler-header-badge">
          <span>✉️ THƯ SẤM TỪ BỘ PHÁP THUẬT & GRINGOTTS</span>
        </div>

        {/* Recipient */}
        <div className="howler-recipient-tag">
          Gửi phù thủy: <strong>{details.debtorName}</strong> ({details.debtorHouse})
        </div>

        {/* Howler Mouth Visual */}
        <div className="howler-mouth-container">
          <div className="howler-teeth-top" />
          <div className="howler-mouth-opening">
            <span>⚡ HOGWARTS HOWLER ⚡</span>
          </div>
        </div>

        {/* Troll Title */}
        <div className="howler-troll-title">{details.humorousTitle}</div>

        {/* Screaming Quote */}
        <div className="howler-screaming-quote-box">
          <p className="howler-screaming-text">"{details.humorousQuote}"</p>
        </div>

        {/* Contextual Incident Breakdown */}
        <div className="howler-details-grid">
          <div className="howler-detail-row">
            <span className="howler-detail-icon">💥</span>
            <div>
              <div className="howler-detail-label">Khoản nợ chí mạng</div>
              <div className="howler-detail-val">
                {galleons(details.debtAmount)} — {details.reason}
              </div>
            </div>
          </div>

          <div className="howler-detail-row">
            <span className="howler-detail-icon">💀</span>
            <div>
              <div className="howler-detail-label">Bên thụ hưởng tài sản</div>
              <div className="howler-detail-val">
                {details.creditorName || 'Ngân Sách Bộ Pháp Thuật'}
              </div>
            </div>
          </div>

          <div className="howler-detail-row">
            <span className="howler-detail-icon">⚖️</span>
            <div>
              <div className="howler-detail-label">Án phạt chính thức</div>
              <div className="howler-detail-val is-punishment">{details.humorousPunishment}</div>
            </div>
          </div>
        </div>

        {/* Disastrous Match Stats */}
        {details.statSummary && (
          <div className="howler-stats-bar">
            <div className="howler-stat-col">
              <div className="stat-title">Tổng tiền cúng dường</div>
              <div className="stat-num">{galleons(details.statSummary.totalLost)}</div>
            </div>
            <div className="howler-stat-col">
              <div className="stat-title">Đòn đau nhất</div>
              <div className="stat-num">{galleons(details.statSummary.highestRentPaid)}</div>
            </div>
            <div className="howler-stat-col">
              <div className="stat-title">Đất bị tịch thu</div>
              <div className="stat-num">{details.statSummary.propertiesLost} ô</div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="howler-actions-row">
          {!isGameOver && (
            <button className="btn-howler-spectate" onClick={onSpectate}>
              👁️ Làm Khán Giả Xem Tiếp
            </button>
          )}

          {onRestart && (
            <button className="btn-howler-replay" onClick={onRestart}>
              🔄 Phục Thù (Chơi Lại)
            </button>
          )}

          <button className="btn-howler-leave" onClick={onLeave}>
            🚪 Rời Bàn / Về Sảnh
          </button>
        </div>
      </div>
    </div>
  );
};
