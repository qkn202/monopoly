/**
 * THUẬT TOÁN TÍNH TOÁN QUY MÔ BÀN CỜ TỐI ƯU CHO 2 ĐẾN 5 NGƯỜI CHƠI
 * Đồ án: Hogwarts Monopoly (Hệ thống Cờ Tỷ Phú Ma Thuật)
 *
 * Tiêu chí đánh giá:
 * 1. Tỷ lệ phân bổ đất/người chơi (Target: 5 - 8 ô/người)
 * 2. Chu kỳ vòng quay (Lap cycle = TotalTiles / 7 bước trung bình)
 * 3. Mật độ va chạm & trả phí thuê (Hazard collision density)
 * 4. Khả năng tạo Monopoly & cơ chế Hostile Takeover
 * 5. Nhịp độ trận đấu (Pacing: 20 - 30 phút / 20 - 28 vòng)
 * 6. Tỷ lệ bế tắc cù cưa (Stalemate rate)
 */

interface BoardSpec {
  totalTiles: number;
  properties: number;
  colorSets: { twoTileSets: number; threeTileSets: number; stations: number; utilities: number };
  cornersAndSpecial: number; // GO, Jail, Parking, GoToJail, Cards, Taxes
  description: string;
}

const CANDIDATE_BOARDS: BoardSpec[] = [
  {
    totalTiles: 20,
    properties: 14,
    colorSets: { twoTileSets: 7, threeTileSets: 0, stations: 0, utilities: 0 },
    cornersAndSpecial: 6, // 4 corners + 2 cards
    description: 'Bàn cờ Mini / Siêu Tốc (20 ô, 14 ô đất - 7 bộ 2 ô)',
  },
  {
    totalTiles: 24,
    properties: 16,
    colorSets: { twoTileSets: 6, threeTileSets: 1, stations: 1, utilities: 0 },
    cornersAndSpecial: 8, // 4 corners + 3 cards + 1 tax
    description: 'Bàn cờ Compact (24 ô, 16 ô đất - 6 bộ 2 ô + 1 bộ 3 ô + 1 ga)',
  },
  {
    totalTiles: 28,
    properties: 20,
    colorSets: { twoTileSets: 4, threeTileSets: 3, stations: 2, utilities: 1 },
    cornersAndSpecial: 8, // 4 corners + 3 cards + 1 tax
    description: 'Bàn cờ Rút Gọn (28 ô, 20 ô đất - 4 bộ 2 ô + 3 bộ 3 ô + 2 ga + 1 tiện ích)',
  },
  {
    totalTiles: 32,
    properties: 22,
    colorSets: { twoTileSets: 2, threeTileSets: 5, stations: 2, utilities: 1 },
    cornersAndSpecial: 10, // 4 corners + 4 cards + 2 tax
    description: 'Bàn cờ Trung Bình (32 ô, 22 ô đất - 2 bộ 2 ô + 5 bộ 3 ô + 2 ga + 1 tiện ích)',
  },
  {
    totalTiles: 36,
    properties: 25,
    colorSets: { twoTileSets: 2, threeTileSets: 6, stations: 3, utilities: 0 },
    cornersAndSpecial: 11, // 4 corners + 5 cards + 2 tax
    description: 'Bàn cờ Tiêu Chuẩn Thu Nhỏ (36 ô, 25 ô đất - 2 bộ 2 ô + 6 bộ 3 ô + 3 ga)',
  },
  {
    totalTiles: 40,
    properties: 28,
    colorSets: { twoTileSets: 2, threeTileSets: 6, stations: 4, utilities: 2 },
    cornersAndSpecial: 12, // 4 corners + 6 cards + 2 tax
    description: 'Bàn cờ Cổ Điển Hiện Tại (40 ô, 28 ô đất - 2 bộ 2 ô + 6 bộ 3 ô + 4 ga + 2 tiện ích)',
  },
  {
    totalTiles: 48,
    properties: 34,
    colorSets: { twoTileSets: 2, threeTileSets: 8, stations: 4, utilities: 2 },
    cornersAndSpecial: 14,
    description: 'Đại Bàn Cờ Mega (48 ô, 34 ô đất - 2 bộ 2 ô + 8 bộ 3 ô + 4 ga + 2 tiện ích)',
  },
];

interface AnalysisMetric {
  board: BoardSpec;
  players: number;
  propsPerPlayer: number;
  turnsPerLap: number;
  lapsIn25Rounds: number;
  hazardDensityPct: number;
  expectedMonopolyFormedProb: number;
  actionDensityScore: number;
  optimalScore: number; // 0 - 100
  verdict: 'RẤT TỐT' | 'TỐT' | 'TRUNG BÌNH' | 'KÉM' | 'KHÔNG PHÙ HỢP';
  pros: string;
  cons: string;
}

function analyzeConfiguration(board: BoardSpec, players: number): AnalysisMetric {
  const propsPerPlayer = board.properties / players;
  const avgRoll = 7; // 2d6 average
  const turnsPerLap = board.totalTiles / avgRoll;
  const lapsIn25Rounds = (25 * avgRoll) / board.totalTiles;

  // Hazard density: When properties are owned, what is probability of stepping on an opponent's tile?
  const opponentProps = propsPerPlayer * (players - 1);
  const hazardDensityPct = (opponentProps / board.totalTiles) * 100;

  // Probability of at least one natural monopoly formed without trading
  let probAnyMonopoly = 0;
  const totalSets = board.colorSets.twoTileSets + board.colorSets.threeTileSets;
  for (let s = 0; s < board.colorSets.twoTileSets; s++) {
    const probOnePlayer = Math.pow(1 / players, 2);
    const probAny = 1 - Math.pow(1 - probOnePlayer, players);
    probAnyMonopoly = 1 - (1 - probAnyMonopoly) * (1 - probAny);
  }
  for (let s = 0; s < board.colorSets.threeTileSets; s++) {
    const probOnePlayer = Math.pow(1 / players, 3);
    const probAny = 1 - Math.pow(1 - probOnePlayer, players);
    probAnyMonopoly = 1 - (1 - probAnyMonopoly) * (1 - probAny);
  }

  // Scoring algorithm (100-point scale based on game design ergonomics):
  // 1. Props per player: Ideal 5.5 - 7.5
  let propScore = 100 - Math.abs(propsPerPlayer - 6.5) * 18;

  // 2. Lap pacing: Ideal 3.5 - 5.5 laps in 25 rounds (turnsPerLap 5 - 7)
  let lapScore = 100 - Math.abs(turnsPerLap - 5.5) * 16;

  // 3. Hazard density: Ideal 30% - 50%
  let hazardScore = 100 - Math.abs(hazardDensityPct - 40) * 2.2;

  // 4. Special rule adjustment:
  // For 2 players, 1v1 duel requires smaller board so players collide frequently and can upgrade
  if (players === 2) {
    if (board.totalTiles <= 24) propScore += 15;
    if (board.totalTiles >= 36) propScore -= 25;
  }
  // For 5 players, large board needed to avoid overcrowded hazard and grant enough assets
  if (players === 5) {
    if (board.totalTiles >= 36) propScore += 12;
    if (board.totalTiles <= 24) propScore -= 30;
  }

  const rawScore = propScore * 0.35 + lapScore * 0.3 + hazardScore * 0.35;
  const optimalScore = Math.max(15, Math.min(98, Math.round(rawScore)));

  let verdict: AnalysisMetric['verdict'] = 'TRUNG BÌNH';
  if (optimalScore >= 88) verdict = 'RẤT TỐT';
  else if (optimalScore >= 75) verdict = 'TỐT';
  else if (optimalScore >= 60) verdict = 'TRUNG BÌNH';
  else if (optimalScore >= 45) verdict = 'KÉM';
  else verdict = 'KHÔNG PHÙ HỢP';

  let pros = '';
  let cons = '';

  if (players === 2) {
    if (board.totalTiles <= 24) {
      pros = 'Đối đầu trực diện nhanh, vòng quay 3.4 lượt giúp nâng cấp túp lều/lâu đài nhanh, không bị cù cưa.';
      cons = 'Ít ô đất chiến thuật phụ, người chơi lỡ vận đen dễ thua sớm.';
    } else {
      pros = 'Nhiều đất để mua, không sợ hết đất.';
      cons = 'Quá loãng! 2 người chơi ở 2 góc bàn cờ, chu kỳ đi 6 lượt mới qua 1 vòng, rất ít khi chạm mặt trả tiền thuê.';
    }
  } else if (players === 3) {
    if (board.totalTiles >= 24 && board.totalTiles <= 32) {
      pros = 'Cân bằng hoàn hảo giữa mật độ va chạm (38%) và số đất mỗi người (5.3 - 7.3 ô).';
      cons = 'Cần thương lượng hoặc Hostile Takeover để hoàn thiện bộ màu.';
    } else if (board.totalTiles < 24) {
      pros = 'Trận đấu diễn ra chớp nhoáng (15-20p).';
      cons = 'Mỗi người chỉ cầm ~4.5 ô đất, thiếu chiều sâu xây dựng.';
    } else {
      pros = 'Không gian rộng rãi, nhiều nhóm màu.';
      cons = 'Hơi dài nếu không có người tích cực xây nhà hoặc mua đứt.';
    }
  } else if (players === 4) {
    if (board.totalTiles >= 32 && board.totalTiles <= 40) {
      pros = 'Quy chuẩn kinh điển! Mỗi người sở hữu 6-7 ô đất, tỷ lệ cọ xát 45-49%, tính thương lượng và cạnh tranh cực cao.';
      cons = 'Trận đấu chuẩn mực kéo dài khoảng 25-30 phút (kết thúc hoàn hảo trước khi hết timer 30p).';
    } else if (board.totalTiles < 32) {
      pros = 'Nhịp độ dồn dập, tiền thuê nổ liên tục.';
      cons = 'Đất ít (chỉ 3.5 - 5 ô/người), dễ có 1 người xui xẻo bị loại sớm từ vòng 5-8.';
    } else {
      pros = 'Rất nhiều đất, phong phú thẻ bài.';
      cons = 'Dễ bị kéo dài quá 30 phút nếu không ai có đủ tiền mua đứt.';
    }
  } else {
    // 5 players
    if (board.totalTiles >= 36) {
      pros = 'Đủ không gian cho 5 người chơi chia sẻ tài nguyên, mỗi người được 5-6.8 ô đất, tránh việc quá nghẽn cờ.';
      cons = 'Cần thời gian chờ lượt (downtime) vì 5 người quay vòng.';
    } else {
      pros = 'Thời gian ván ngắn.';
      cons = 'Quá chật chội! Mật độ nguy hiểm >55%, vừa ra tù là giẫm vào đất đối thủ, nhiều người bị loại khi chưa kịp xây nhà.';
    }
  }

  return {
    board,
    players,
    propsPerPlayer: Math.round(propsPerPlayer * 10) / 10,
    turnsPerLap: Math.round(turnsPerLap * 10) / 10,
    lapsIn25Rounds: Math.round(lapsIn25Rounds * 10) / 10,
    hazardDensityPct: Math.round(hazardDensityPct * 10) / 10,
    expectedMonopolyFormedProb: Math.round(probAnyMonopoly * 100),
    actionDensityScore: Math.round((hazardDensityPct / 100) * 80 + 20),
    optimalScore,
    verdict,
    pros,
    cons,
  };
}

console.log('========================================================================================================================');
console.log('        KẾT QUẢ TÍNH TOÁN & ĐÁNH GIÁ THUẬT TOÁN: BÀN CỜ MONOPOLY TỐI ƯU TỪ 2 ĐẾN 5 NGƯỜI CHƠI');
console.log('========================================================================================================================\n');

for (const p of [2, 3, 4, 5]) {
  console.log(`\n========================================================================================================================`);
  console.log(` 👥 NHÓM ${p} NGƯỜI CHƠI`);
  console.log(`========================================================================================================================`);
  console.log(
    `| ${'Quy mô bàn cờ'.padEnd(28)} | ${'Tổng ô'.padStart(6)} | ${'Ô đất'.padStart(5)} | ${'Đất/người'.padStart(9)} | ${'Lượt/vòng'.padStart(9)} | ${'Mật độ cọ xát'.padStart(13)} | ${'Monopoly %'.padStart(10)} | ${'Điểm'.padStart(5)} | ${'Đánh giá'.padEnd(14)} |`
  );
  console.log(`|${'-'.repeat(30)}|${'-'.repeat(8)}|${'-'.repeat(7)}|${'-'.repeat(11)}|${'-'.repeat(11)}|${'-'.repeat(15)}|${'-'.repeat(12)}|${'-'.repeat(7)}|${'-'.repeat(16)}|`);

  const metrics: AnalysisMetric[] = [];
  for (const b of CANDIDATE_BOARDS) {
    const m = analyzeConfiguration(b, p);
    metrics.push(m);
    console.log(
      `| ${b.description.slice(0, 28).padEnd(28)} | ${b.totalTiles.toString().padStart(6)} | ${b.properties.toString().padStart(5)} | ${m.propsPerPlayer.toFixed(1).padStart(9)} | ${m.turnsPerLap.toFixed(1).padStart(9)} | ${(m.hazardDensityPct.toFixed(1) + '%').padStart(13)} | ${(m.expectedMonopolyFormedProb + '%').padStart(10)} | ${m.optimalScore.toString().padStart(5)} | ${m.verdict.padEnd(14)} |`
    );
  }

  // Sort best
  metrics.sort((a, b) => b.optimalScore - a.optimalScore);
  const best = metrics[0];
  const second = metrics[1];

  console.log(`\n👉 KẾT LUẬN CHO ${p} NGƯỜI CHƠI:`);
  console.log(`   ⭐ Khuyến nghị TỐT NHẤT: ${best.board.description}`);
  console.log(`      • Tổng số ô: ${best.board.totalTiles} ô (Trong đó có ${best.board.properties} ô đất mua được).`);
  console.log(`      • Phân bổ trung bình: ${best.propsPerPlayer} ô đất / người chơi.`);
  console.log(`      • Tần suất cọ xát: ${best.hazardDensityPct}% (Mỗi vòng quay mất ${best.turnsPerLap} lượt đổ xúc xắc).`);
  console.log(`      • Ưu điểm: ${best.pros}`);
  if (second.optimalScore >= 75) {
    console.log(`   ✨ Phương án dự phòng: ${second.board.description} (Điểm: ${second.optimalScore}/100) — ${second.pros}`);
  }
}
