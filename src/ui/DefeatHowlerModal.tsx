import React, { useEffect, useState, useCallback } from 'react';
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
  onClose?: () => void;
  autoDismissSeconds?: number;
}

export const DefeatHowlerModal: React.FC<DefeatHowlerModalProps> = ({
  details,
  isGameOver = false,
  onSpectate,
  onLeave,
  onRestart,
  onClose,
  autoDismissSeconds = 12,
}) => {
  const [secondsLeft, setSecondsLeft] = useState<number>(autoDismissSeconds);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  // Trigger procedural audio on mount
  useEffect(() => {
    soundManager.playDefeatHowler();
  }, []);

  const handleDismiss = useCallback(() => {
    if (onClose) {
      onClose();
    } else {
      onSpectate();
    }
  }, [onClose, onSpectate]);

  // Auto-dismiss countdown to prevent lag / performance stalling
  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleDismiss();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPaused, handleDismiss]);

  // Keyboard shortcut: Esc or Space to close immediately
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === ' ') {
        e.preventDefault();
        handleDismiss();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDismiss]);

  return (
    <div
      className="howler-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleDismiss();
        }
      }}
    >
      <div className="howler-envelope-card" onClick={(e) => e.stopPropagation()}>
        {/* Top-Right Corner Close Button */}
        <button
          className="howler-close-btn"
          onClick={handleDismiss}
          title="Tắt Thư Sấm (Esc) — Tránh giật lag bàn cờ"
          aria-label="Đóng thư sấm"
        >
          ✕
        </button>

        {/* Auto-dismiss Countdown Bar */}
        <div className="howler-countdown-bar">
          <div className="howler-countdown-info">
            <span className="howler-countdown-clock">⏱️</span>
            <span>
              Tự động đóng sau <strong className="howler-countdown-num">{secondsLeft}s</strong> (tránh giật lag bàn cờ)
            </span>
          </div>
          <div className="howler-countdown-ctrls">
            <button
              type="button"
              className="btn-howler-pill"
              onClick={() => setIsPaused((p) => !p)}
              title={isPaused ? 'Tiếp tục đếm ngược' : 'Tạm dừng đếm ngược để đọc'}
            >
              {isPaused ? '▶ Tiếp tục đếm' : '⏸ Đọc thêm'}
            </button>
            <button
              type="button"
              className="btn-howler-pill is-close"
              onClick={handleDismiss}
              title="Đóng Thư Sấm ngay lập tức (phím Esc)"
            >
              ✕ Tắt ngay
            </button>
          </div>
        </div>
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
          <button
            className="btn-howler-dismiss"
            onClick={handleDismiss}
            title="Tắt Thư Sấm để quan sát bàn cờ mượt mà (tránh giật lag)"
          >
            ✕ Tắt Thư Sấm ({secondsLeft > 0 ? `${secondsLeft}s` : 'Ngay'})
          </button>

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
