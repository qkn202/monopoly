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
            <span>✦ TRÁT CẢNH BÁO BỘ PHÁP THUẬT • VÒNG {event.round} ✦</span>
          </div>

          <h2 className="curse-decree-title">BÃO LỜI NGUYỄN HẮC ÁM</h2>
          <div className="curse-decree-subtitle">CHÚA TỂ VOLDEMORT &amp; TỬ THẦN THỰC TỬ TRỖI DẬY</div>

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
            <div className="plaque-header">TIỀN THUÊ ĐẤT &amp; THUẾ NỘP PHẠT</div>
            <div className="plaque-value-row">
              <span className="plaque-multiplier-badge">TĂNG GẤP {event.multiplier} LẦN</span>
              <span className="plaque-number">X{event.multiplier}</span>
            </div>
            <div className="plaque-sub">TOÀN BỘ 40 LÃNH ĐỊA HOGWARTS BỊ NHIỄM TÀ KHÍ</div>
          </div>

          <p className="curse-lore-text">
            Lời nguyền cổ xưa đã giáng xuống toàn bộ thế giới phù thủy. 
            Mỗi lần dừng chân trên đất của đối thủ, bạn sẽ phải trả <strong>gấp {event.multiplier} lần số tiền Galleons</strong>!
          </p>

          <div className="curse-warning-box">
            <span>⚠️ Hãy thận trọng trong từng bước gieo xúc xắc để bảo toàn gia sản!</span>
          </div>

          <button className="btn-curse-decree-accept" onClick={onDismiss}>
            <span>⚔️ CHẤP NHẬN THÁCH THỨC [{countdown}s]</span>
          </button>
        </div>
      </div>
    </div>
  );
};
