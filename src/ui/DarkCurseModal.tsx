import React, { useEffect, useState } from 'react';
import { EscalationEvent } from '../core/types';
import './DarkCurseModal.css';

interface DarkCurseModalProps {
  event: EscalationEvent | null;
  onDismiss: () => void;
}

export const DarkCurseModal: React.FC<DarkCurseModalProps> = ({ event, onDismiss }) => {
  const [countdown, setCountdown] = useState<number>(5);

  useEffect(() => {
    if (!event) return;
    setCountdown(5);

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onDismiss();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [event?.timestamp, onDismiss]);

  if (!event) return null;

  return (
    <div className="dark-curse-backdrop" onClick={onDismiss}>
      <div className="dark-curse-proclamation-frame" onClick={(e) => e.stopPropagation()}>
        {/* Ornate Gilded Corner Brackets */}
        <div className="curse-corner-filigree top-left" />
        <div className="curse-corner-filigree top-right" />
        <div className="curse-corner-filigree bottom-left" />
        <div className="curse-corner-filigree bottom-right" />

        {/* Inner Engraved Runic Border */}
        <div className="curse-inner-border">
          {/* Header Wax Seal & Death Eater Insignia */}
          <div className="curse-seal-wrapper">
            <div className="curse-wax-seal">
              <span className="seal-skull">☠️</span>
              <span className="seal-lightning">⚡</span>
            </div>
            <div className="curse-seal-ribbon" />
          </div>

          <div className="curse-parchment-tag">
            <span>Bộ Pháp thuật · vòng {event.round}</span>
          </div>

          <h2 className="curse-decree-title">Lời nguyền Hắc ám</h2>
          <div className="curse-decree-subtitle">Voldemort và Tử thần Thực tử trỗi dậy</div>

          {/* Runic Divider */}
          <div className="curse-runic-divider">
            <span className="rune-glyph">ᛟ</span>
            <span className="rune-star">✦</span>
            <span className="rune-center">☠️</span>
            <span className="rune-star">✦</span>
            <span className="rune-glyph">ᛟ</span>
          </div>

          {/* Golden Embossed Multiplier Plaque */}
          <div className="curse-parchment-plaque">
            <div className="plaque-header">Tiền thuê và thuế</div>
            <div className="plaque-value-row">
              <span className="plaque-multiplier-badge">gấp {event.multiplier} lần</span>
              <span className="plaque-number">X{event.multiplier}</span>
            </div>
            <div className="plaque-sub">Áp dụng cho cả 40 ô</div>
          </div>

          <p className="curse-lore-text">
            Từ giờ, mỗi lần dừng trên đất của đối thủ hay ô thuế, bạn trả <strong>gấp {event.multiplier} lần</strong>.
          </p>

          <div className="curse-warning-box">
            <span>Giữ tiền mặt để không phá sản.</span>
          </div>

          <button className="btn-curse-decree-accept" onClick={onDismiss}>
            <span>Tiếp tục ({countdown}s)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
