import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './BankruptcyConfirmModal.css';

interface BankruptcyConfirmModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  debtorName?: string;
  debtAmount?: number;
  creditorName?: string;
}

const THAO_MAI_QUOTES = [
  {
    title: 'Ủa, tính buông xuôi đầu hàng thiệt đó hả cưng? 🥺💅',
    lead: 'Ôi thương ghê chưa kìa! Đại phù thủy kiệt xuất của chúng mình mới quẹt nhẹ có mấy đồng Galleons mà đã vội vàng bấm nút bỏ cuộc chơi rồi sao?',
    body: 'Đất đai mồ hôi nước mắt cày cuốc nãy giờ định đem dâng không cho đối thủ ăn mừng trên nỗi đau của bạn à? Nghĩ kỹ lại đi cưng ơi, buông tay sớm thế này cả bàn cờ người ta cười cho thúi mũi bây giờ đó nha~',
    sub: '💅 Còn thở là còn gỡ, thế chấp miếng đất cắm dùi ráng gồng thêm hiệp nữa đi nè!',
  },
  {
    title: 'Ối dồi ôi bồ tèo ơi, sao vội giơ cờ trắng thế nè? 🏳️💔',
    lead: 'Tưởng bạn bản lĩnh kiên cường, giàu sang danh gia vọng tộc lắm cơ mà? Sao mới bị đòi nợ tí xíu đã bấm nút chạy trốn thế này?',
    body: 'Ngoài kia bao nhiêu pháp sư phá sản vẫn ngẩng cao đầu đi làm công nhân hót phân cú ở tháp bưu điện để trả nợ. Còn bạn vừa thấy số âm đã đòi "tuyên bố phá sản" là sao ta? Đừng để đối thủ đắc ý cười ha hả vào mặt bạn chứ~',
    sub: '🥺 Thôi nín đi, bán bớt căn chòi tranh đi trả nợ rồi gồng tiếp coi nào!',
  },
  {
    title: 'Chèn ơi, chắc là trượt tay bấm nhầm nút đúng hông nè? 🥰💸',
    lead: 'Chứ một pháp sư thông minh, đỉnh chóp, tài sắc vẹn toàn như bạn làm sao mà chịu cảnh phá sản nhục nhã thế này được!',
    body: 'Nghĩ lại cảnh tay trắng dọn đồ về thế giới Muggle làm công nhân xoay ca 12 tiếng/ngày xem có xót xa không? Nhìn đối thủ đang hí hửng chuẩn bị chia chác đất đai của bạn kìa, có thấy cay nhức cái nách không nè?',
    sub: '✨ Hít một hơi thật sâu, bấm nút QUAY LẠI gồng tiếp đi cho đối thủ tức chơi!',
  },
  {
    title: 'Ủa alo? Định "sủi" sớm về nhà trùm chăn khóc với má hả? 🦉🍵',
    lead: 'Đang chơi vui mà bạn tính bỏ ngang để mọi người chê là "chúa tể đầu hàng, ông hoàng nợ nần" sao?',
    body: 'Mới thiếu có xíu tiền phạt mà đã vội vàng buông xuôi, sau này ra đời làm sao đối đầu với Chúa tể Hắc ám được đây? Tự tin lên, gỡ lại danh dự đi, đừng làm cả nhà Hogwarts thất vọng chứ bồ tèo ơi~',
    sub: '💅 Người thành công không bao giờ bỏ cuộc, người bỏ cuộc thì quê xệ luôn á!',
  },
  {
    title: 'Trời đất ơi, làm sao mà nỡ buông tay thế này chứ? 🍵✨',
    lead: 'Biết là nợ nần chồng chất đau đớn lắm, nhưng nhắm mắt xuôi tay lúc này là mất hết đó cưng!',
    body: 'Bạn mà phá sản bây giờ thì đối thủ được nước làm tới, vừa đếm tiền vừa cười mỉa mai bạn suốt cả tháng trời luôn á. Có gan chơi thì có gan chịu, thế chấp tài sản đi rồi vòng sau xúc xắc lội ngược dòng cho họ lé mắt coi!',
    sub: '💖 Đừng bấm phá sản nha, người ta khịa cho là khóc ròng ba ngày ba đêm á~',
  },
];

export const BankruptcyConfirmModal: React.FC<BankruptcyConfirmModalProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  debtorName,
  debtAmount,
  creditorName,
}) => {
  const [quoteIndex, setQuoteIndex] = useState(0);

  useEffect(() => {
    if (isOpen) {
      // Pick a random funny thảo mai quote each time modal opens
      const randomIdx = Math.floor(Math.random() * THAO_MAI_QUOTES.length);
      setQuoteIndex(randomIdx);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const quote = THAO_MAI_QUOTES[quoteIndex] || THAO_MAI_QUOTES[0];

  return createPortal(
    <div className="thao-mai-backdrop" onClick={onCancel}>
      <div
        className="thao-mai-modal-frame"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Ornate Gilded Corner Brackets */}
        <div className="thao-mai-corner tl" />
        <div className="thao-mai-corner tr" />
        <div className="thao-mai-corner bl" />
        <div className="thao-mai-corner br" />

        {/* Decorative Top Wax Seal */}
        <div className="thao-mai-seal-wrapper">
          <div className="thao-mai-seal-badge">
            <span className="thao-mai-seal-icon">💅</span>
          </div>
          <div className="thao-mai-seal-ribbon" />
        </div>

        {/* Header Tag */}
        <div className="thao-mai-tag">
          <span>🍵 GÓC THẢO MAI ĐỘC QUYỀN · BỘ PHÁP THUẬT 💅</span>
        </div>

        {/* Humorous Thảo Mai Title */}
        <h2 className="thao-mai-title">{quote.title}</h2>

        {/* Context Debt Banner if available */}
        {debtAmount && debtAmount > 0 && (
          <div className="thao-mai-debt-pill">
            <span>Khoản nợ:</span>
            <strong className="thao-mai-debt-num">−{debtAmount.toLocaleString()} Galleons</strong>
            {creditorName && (
              <span className="thao-mai-creditor"> (cho {creditorName})</span>
            )}
          </div>
        )}

        {/* Thảo Mai Sarcastic Body */}
        <div className="thao-mai-letter-body">
          <p className="thao-mai-lead">
            {debtorName ? `Phù thủy ${debtorName} ơi! ` : ''}
            {quote.lead}
          </p>
          <p className="thao-mai-text">
            {quote.body}
          </p>
          <div className="thao-mai-sub-box">
            {quote.sub}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="thao-mai-btn-row">
          <button
            type="button"
            className="thao-mai-btn-cancel"
            onClick={onCancel}
            autoFocus
          >
            <span>💅 Dạ em bấm nhầm, để em gồng tiếp!</span>
            <kbd className="thao-mai-kbd">Esc</kbd>
          </button>

          <button
            type="button"
            className="thao-mai-btn-confirm"
            onClick={onConfirm}
          >
            <span>💥 Chấp nhận nhục nhã, phá sản luôn!</span>
          </button>
        </div>

        <div className="thao-mai-hint">
          💡 Bạn vẫn có thể thế chấp đất hoặc dỡ bớt nhà để lấy Galleons trả nợ!
        </div>
      </div>
    </div>,
    document.body
  );
};
