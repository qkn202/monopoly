import { Player, TileConfig, GameState, BankruptcyDetails } from './types';
import { galleons } from '../hpvn/money';

/**
 * Generates dramatic, contextual, and hilarious Howler (Thư Sấm) defeat records.
 * Perfectly blends Harry Potter lore with witty gamer banter.
 */
export function generateBankruptcyDetails(
  debtor: Player,
  creditor: Player | undefined,
  amount: number,
  reason: string,
  tile: TileConfig | undefined,
  state?: GameState
): BankruptcyDetails {
  const creditorName = creditor?.name || (reason.toLowerCase().includes('thuế') ? 'Bộ Pháp Thuật' : 'Ngân Hàng Gringotts');
  const tileName = tile?.name || (reason.includes('"') ? reason.split('"')[1] : 'Mảnh đất tử thần');

  let humorousTitle = '⭐ NHÀ TỪ THIỆN CỦA NĂM ⭐';
  let humorousQuote = '';
  let humorousPunishment = '';

  const lowerReason = (reason || '').toLowerCase();
  const isTax = lowerReason.includes('thuế') || lowerReason.includes('bộ pháp thuật');
  const isCurse = lowerReason.includes('nguyền') || lowerReason.includes('voldemort') || lowerReason.includes('dark curse');
  const isAuction = lowerReason.includes('đấu giá') || lowerReason.includes('auction');
  const isJail = lowerReason.includes('azkaban') || lowerReason.includes('phạt');
  const isStationOrUtil = tile?.type === 'STATION' || tile?.type === 'UTILITY';

  if (creditor && !isTax && !isCurse) {
    if (tile && (debtor.houses[tile.id] !== undefined || tile.rentTiers)) {
      // 1. Defeated by landing on another player's property (Rent)
      const titles = [
        '⭐ NHÀ TỪ THIỆN CỦA NĂM ⭐',
        '🏰 ĐẠI GIA THUÊ TRỌ KHÉT TIẾNG 🏰',
        '💸 TẤM CHIẾU MỚI LẠC BƯỚC 💸',
        '🧹 CÚ NÉM TIỀN QUA CỬA SỔ LỊCH SỬ 🧹'
      ];
      humorousTitle = titles[Math.floor(Math.random() * titles.length)];

      humorousQuote = `SAO NGƯƠI DÁM BƯỚC CHÂN VÀO "${tileName}" CỦA ${creditorName.toUpperCase()} KHI TRONG TÚI CHẲNG CÒN NỔI 1 XU KNUT?! Cả lâu đài tráng lệ người ta xây dựng kỳ công như thế, ngươi nghĩ là trạm phát cơm từ thiện chắc?! Ngươi đã cúng toàn bộ ${galleons(amount)} tài sản còn lại để ${creditorName} hoàn thiện cơ ngơi! Cả dòng họ đang ôm mặt xấu hổ vì ngươi rồi!`;

      humorousPunishment = `Tịch thu toàn bộ đũa phép và chổi bay đem bán đấu giá tại Gringotts; trục xuất sang thế giới Muggle đi làm công nhân xoay ca 12 tiếng/ngày để trả nợ!`;
    } else if (isStationOrUtil) {
      // 2. Station or Utility
      humorousTitle = '🚂 KHÁCH ĐI LẬU VÉ HOGWARTS EXPRESS 🚂';
      humorousQuote = `NGƯƠI DÁM XÀI CHÙA "${tileName}" CỦA ${creditorName.toUpperCase()} MÀ KHÔNG TRẢ TIỀN SAO?! Còi tàu vừa hú và ngươi đã bị ném thẳng xuống đầm lầy vì rỗng túi! ${galleons(amount)} tiền vé đã tiễn ngươi một vé thẳng cánh ra khỏi bàn cờ!`;
      humorousPunishment = `Bị phạt đi bộ dọc tuyến đường sắt từ King's Cross về Hogwarts gánh than bù tiền vé!`;
    } else {
      humorousTitle = '💸 TÁN GIA BẠI SẢN VÌ CHỦ NỢ 💸';
      humorousQuote = `TOÀN BỘ CƠ NGHIỆP CỦA BẠN ĐÃ RƠI GỌN GÀNG VÀO TÚI CỦA ${creditorName.toUpperCase()}! Một pha tự dâng nộp bản thân và gia tài không thể hào phóng hơn!`;
      humorousPunishment = `Chuyển về làm gia tinh rửa chén bát không lương cho ${creditorName} trong 7 năm!`;
    }
  } else if (isTax) {
    // 3. Ministry Tax Debt
    const titles = [
      '📜 CÔNG DÂN MẪU MỰC CỦA BỘ PHÁP THUẬT 📜',
      '⚖️ TẬN TỤY ĐÓNG THUẾ ĐẾN HẠT BỤI CUỐI CÙNG ⚖️',
      '🏛️ BẢN HỢP ĐỒNG SIẾT NỢ HOÀNG GIA 🏛️'
    ];
    humorousTitle = titles[Math.floor(Math.random() * titles.length)];

    humorousQuote = `BỘ PHÁP THUẬT VÀ BỘ TRƯỞNG FUDGE XIN TRÂN TRỌNG CẢM ƠN KHOẢN ĐÓNG GÓP ${galleons(amount)} VÔ CÙNG QUÝ BÁU CỦA BẠN! Sự hy sinh cả sự nghiệp của bạn sẽ được ghi vào sổ vàng ngân sách... mặc dù ngay sau đó bạn phải ra gầm cầu Hogsmeade nằm ngủ!`;

    humorousPunishment = `Được Bộ Pháp Thuật 'ưu ái' điều động đi cọ rửa vạc thí nghiệm độc dược cho Giáo sư Snape không trợ cấp!`;
  } else if (isCurse) {
    // 4. Dark Curse Storm Escalation
    humorousTitle = '⚡ CỘT THU LÔI HÚT VẬN ĐEN ⚡';
    humorousQuote = `CHÚA TỂ VOLDEMORT CÒN CHƯA KỊP RA ĐÒN THÌ TÚI TIỀN CỦA BẠN ĐÃ TỰ BỐC CHÁY THÀNH TRO! Đi đứng kiểu gì mà để Cơn Nguyền Hắc Ám thổi bay sạch ${galleons(amount)} thế hả?! Một pha bay màu tài chính đi vào lịch sử Hogwarts!`;
    humorousPunishment = `Bị lưu đày vào Rừng Cấm nhặt phân Nhân Mã và bắt sâu độc để kiếm sống qua ngày!`;
  } else if (isAuction) {
    // 5. Auction Failure
    humorousTitle = '🔨 BÀN TAY VÀNG LÀNG ĐỔ NỢ 🔨';
    humorousQuote = `HÔ GIÁ CHO SANG, GIƠ TAY CHO NGẦU RỒI ĐỂ BÂY GIỜ THÀNH CHÚA CHỔM! Ngươi tưởng đang mua kẹo Bơ Gringotts chắc?! Đấu giá hăng hái quá đà khiến két sắt rỗng tuếch đến mức chuột cũng bỏ đi!`;
    humorousPunishment = `Cấm vĩnh viễn không được bén mảng tới các phiên đấu giá phù thủy, tịch thu tư cách phù thủy kinh doanh!`;
  } else if (isJail) {
    // 6. Azkaban Bail or Timeout
    humorousTitle = '⛓️ CƯ DÂN TIÊU BIỂU NGỤC AZKABAN ⛓️';
    humorousQuote = `Ở TRONG TÙ MÀ CŨNG XOAY SỞ ĐỂ PHÁ SẢN ĐƯỢC THÌ ĐÚNG LÀ THIÊN TÀI! Giám Ngục Azkaban còn chưa kịp hút linh hồn thì bạn đã tự hút cạn túi tiền của chính mình rồi!`;
    humorousPunishment = `Gia hạn thời gian lao động công ích quét dọn xà lim Azkaban thêm 10 năm!`;
  } else {
    // 7. General / Magic Card Trap / Bankruptcy
    const titles = [
      '📉 PHÙ THỦY TÀI CHÍNH ÂM VÔ CỰC 📉',
      '🧹 BAY KHÔNG CẦN CHỔI - TỤT DỐC KHÔNG PHANH 🧹',
      '💀 KẺ ĐƯỢC CHỌN... ĐỂ BẠI TRẬN 💀'
    ];
    humorousTitle = titles[Math.floor(Math.random() * titles.length)];

    humorousQuote = `NGÂN HÀNG GRINGOTTS XIN THÔNG BÁO: KÉT SẮT CỦA BẠN ĐÃ RỖNG ĐẾN NỖI MẠNG NHỆN CŨNG KHÔNG BUỒN GIĂNG TỔ! Với khoản nợ ${galleons(amount)}, bạn chính thức ghi tên mình vào danh sách những phù thủy nghèo nhất lịch sử!`;

    humorousPunishment = `Bị yêu tinh Gringotts tước quyền mở két sắt, chuyển hộ khẩu về Quán Đầu Heo làm chân bưng bê!`;
  }

  // Calculate disastrous match statistics
  const playerFinance = state?.playerFinances?.[debtor.id];
  const totalLost = (playerFinance?.totalExpense || 0) + amount;
  const highestRentPaid = playerFinance?.rentExpense || amount;
  const propertiesLost = debtor.properties.length;
  const jailVisits = playerFinance?.landVisitsCount || 0;

  return {
    debtorId: debtor.id,
    debtorName: debtor.name,
    debtorHouse: debtor.house,
    debtorColor: debtor.color,
    creditorId: creditor?.id,
    creditorName,
    creditorHouse: creditor?.house,
    debtAmount: amount,
    reason,
    tileId: tile?.id,
    tileName,
    timestamp: Date.now(),
    humorousTitle,
    humorousQuote,
    humorousPunishment,
    statSummary: {
      totalLost: Math.max(totalLost, amount),
      highestRentPaid: Math.max(highestRentPaid, amount),
      jailVisits,
      propertiesLost,
    },
  };
}
