import React, { useEffect, useRef, useState } from 'react';
import { HouseType } from '../core/types';
import { HOUSE_INFO } from '../core/boardData';
import { identity } from '../hpvn/bridge';
import { SAVE_TTL_MS, SavedGame } from '../hpvn/saveGame';
import { g } from '../hpvn/money';
import './Lobby.css';

// An HPVN invite link opens the game with ?room=CODE.
const invitedRoom = (() => {
  const code = new URLSearchParams(location.search).get('room')?.trim().toUpperCase() ?? '';
  return /^[A-Z0-9]{6}$/.test(code) ? code : '';
})();

export type GameSetupConfig =
  | { mode: 'SOLO'; playerName: string; playerHouse: HouseType; botCount: number; boardSize?: number }
  | { mode: 'HOTSEAT'; players: Array<{ name: string; house: HouseType; isAI: boolean }>; boardSize?: number }
  | { mode: 'ONLINE_HOST'; stake: boolean; boardSize?: number }
  | { mode: 'ONLINE_JOIN'; roomCode: string };

export interface BoardSizePreset {
  size: number;
  title: string;
  icon: string;
  tilesCount: number;
  time: string;
  target: string;
  recPlayers: number;
  recLabel: string;
}

export const BOARD_SIZE_PRESETS: BoardSizePreset[] = [
  {
    size: 20,
    title: '20 ô (Mini / Siêu tốc)',
    icon: '⚡',
    tilesCount: 14,
    time: '~15 phút',
    target: 'Quyết đấu 1v1 gay cấn',
    recPlayers: 2,
    recLabel: '⭐ Đề xuất (2 người)',
  },
  {
    size: 28,
    title: '28 ô (Rút gọn Ma thuật)',
    icon: '🏰',
    tilesCount: 20,
    time: '~20 phút',
    target: 'Chiến thuật 3 người cân bằng',
    recPlayers: 3,
    recLabel: '⭐ Đề xuất (3 người)',
  },
  {
    size: 40,
    title: '40 ô (Cổ điển Hogwarts)',
    icon: '🌟',
    tilesCount: 28,
    time: '~30 phút',
    target: 'Kinh điển 4–8 người chơi',
    recPlayers: 4,
    recLabel: '⭐ Đề xuất (4–8 người)',
  },
];

export function getRecommendedBoardSize(playerCount: number): number {
  if (playerCount <= 2) return 20;
  if (playerCount === 3) return 28;
  return 40;
}

interface LobbyProps {
  onStartGame: (config: GameSetupConfig) => void;
  notice?: string;
  /** A parked local game: offered first, with when it expires. */
  saved?: SavedGame | null;
  onResume?: () => void;
  onDiscard?: () => void;
}

const clock = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
const hhmm = (ms: number) => new Date(ms).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

const AVAILABLE_HOUSES: HouseType[] = [
  'Gryffindor',
  'Slytherin',
  'Ravenclaw',
  'Hufflepuff',
  'Auror',
  'DeathEater',
  'OrderOfPhoenix',
  'Ministry',
];

export const Lobby: React.FC<LobbyProps> = ({ onStartGame, notice, saved, onResume, onDiscard }) => {
  const [selectedMode, setSelectedMode] = useState<'SOLO' | 'ONLINE_HOST' | 'ONLINE_JOIN' | 'HOTSEAT'>(identity && invitedRoom ? 'ONLINE_JOIN' : 'SOLO');
  // In HPVN the name is the signed-in member's; only a standalone page lets you type one.
  const [playerName, setPlayerName] = useState(identity?.displayName || 'Harry Potter');
  const [selectedHouse, setSelectedHouse] = useState<HouseType>(
    () => (Object.keys(HOUSE_INFO) as HouseType[]).find((h) => h.toLowerCase() === identity?.house?.toLowerCase()) ?? 'Gryffindor');
  const [botCount, setBotCount] = useState<number>(3);
  const [boardSize, setBoardSize] = useState<number>(() => getRecommendedBoardSize(3 + 1));
  const [joinCodeInput, setJoinCodeInput] = useState<string>(identity ? invitedRoom : '');
  const [busy, setBusy] = useState(false);
  // The host chooses at creation: a friendly room, or each seat stakes 5.000 real Galleons.
  const [stake, setStake] = useState(false);
  const [error, setError] = useState('');
  const isOnline = selectedMode === 'ONLINE_HOST' || selectedMode === 'ONLINE_JOIN';

  const recommendedSize = getRecommendedBoardSize(
    selectedMode === 'SOLO' ? botCount + 1 : selectedMode === 'HOTSEAT' ? 4 : 2
  );

  const handleBotCountChange = (count: number) => {
    setBotCount(count);
    setBoardSize(getRecommendedBoardSize(count + 1));
  };

  // Following an invite joins straight away (once).
  const autoJoined = useRef(false);
  useEffect(() => {
    if (!identity || !invitedRoom || autoJoined.current) return;
    autoJoined.current = true;
    launch({ mode: 'ONLINE_JOIN', roomCode: invitedRoom });
  }, []);

  const launch = async (config: GameSetupConfig) => {
    setBusy(true);
    try { await onStartGame(config); } finally { setBusy(false); }
  };

  const handleLaunch = () => {
    setError('');
    if (selectedMode === 'SOLO') {
      launch({
        mode: 'SOLO',
        playerName: playerName.trim() || 'Người chơi 1',
        playerHouse: selectedHouse,
        botCount,
        boardSize,
      });
    } else if (selectedMode === 'ONLINE_HOST') {
      launch({ mode: 'ONLINE_HOST', stake, boardSize });
    } else if (selectedMode === 'ONLINE_JOIN') {
      const code = joinCodeInput.trim().toUpperCase();
      if (!/^[A-Z0-9]{6}$/.test(code)) {
        setError('Mã phòng gồm 6 ký tự.');
        return;
      }
      launch({ mode: 'ONLINE_JOIN', roomCode: code });
    } else if (selectedMode === 'HOTSEAT') {
      // 4 local players
      const hotseatPlayers = [
        { name: 'Harry Potter', house: 'Gryffindor' as HouseType, isAI: false },
        { name: 'Draco Malfoy', house: 'Slytherin' as HouseType, isAI: false },
        { name: 'Luna Lovegood', house: 'Ravenclaw' as HouseType, isAI: false },
        { name: 'Cedric Diggory', house: 'Hufflepuff' as HouseType, isAI: false },
      ];
      launch({ mode: 'HOTSEAT', players: hotseatPlayers, boardSize });
    }
  };

  const modes: { id: typeof selectedMode; label: string; hint: string }[] = [
    { id: 'SOLO', label: 'Chơi với bot', hint: 'Một mình, 1–7 bot' },
    ...(identity ? [
      { id: 'ONLINE_HOST' as const, label: 'Tạo phòng', hint: 'Mời bạn qua Floo' },
      { id: 'ONLINE_JOIN' as const, label: 'Vào phòng', hint: 'Nhập mã 6 ký tự' },
    ] : []),
  ];

  const totalTilesCount = boardSize === 20 ? 14 : boardSize === 28 ? 20 : 28;

  return (
    <div className="lobby-overlay">
      <div className="lobby-modal-card hpvn-lobby">
        <header className="hpvn-lobby-head">
          <p className="hpvn-eyebrow">Bàn cờ {boardSize} ô · {totalTilesCount} ô đất phù thủy</p>
          <h1 className="lobby-title">Cờ Tỷ Phú Hogwarts</h1>
          {identity && <p className="hpvn-lobby-who">Phù thủy <strong>{identity.displayName}</strong></p>}
        </header>

        {saved && (() => {
          const st = saved.state;
          const me = st.players.find((p) => p.id === saved.myPlayerId) ?? st.players.find((p) => !p.isAI) ?? st.players[0];
          return (
            <section className="hpvn-resume" aria-label="Ván đang dở">
              <div className="hpvn-resume-head">
                <span className="player-avatar-circle mini-avatar" style={{ borderColor: me.color, background: `${me.color}22` }}>{me.tokenIcon}</span>
                <div>
                  <strong>Ván đang dở</strong>
                  <span>Vòng {st.turnNumber} · còn {clock(st.timer.remainingSeconds)} · {me.name} {g(me.netWorth)}</span>
                </div>
              </div>
              <p className="hpvn-resume-note">Đồng hồ ván đã dừng. Ván tự đóng lúc {hhmm(saved.lastActionAt + SAVE_TTL_MS)} nếu bạn không quay lại.</p>
              <div className="hpvn-resume-actions">
                <button className="btn-bid" onClick={onDiscard}>Bỏ ván này</button>
                <button className="btn-launch-game" onClick={onResume}>Chơi tiếp</button>
              </div>
            </section>
          );
        })()}

        <div className="hpvn-segment" role="tablist" aria-label="Chế độ chơi">
          {modes.map((m) => (
            <button key={m.id} role="tab" aria-selected={selectedMode === m.id}
              className={selectedMode === m.id ? 'is-active' : ''} onClick={() => setSelectedMode(m.id)}>
              <span>{m.label}</span><small>{m.hint}</small>
            </button>
          ))}
        </div>

        {!identity && (
          <label className="hpvn-field">
            <span className="lobby-label">Tên phù thủy</span>
            <input className="lobby-text-input" value={playerName} onChange={(e) => setPlayerName(e.target.value)} placeholder="Nhập tên…" maxLength={20} />
          </label>
        )}

        {!isOnline && (
          <section className="hpvn-field">
            <span className="lobby-label">Quân cờ của bạn</span>
            <div className="hpvn-houses">
              {AVAILABLE_HOUSES.map((houseKey) => {
                const info = HOUSE_INFO[houseKey];
                return (
                  <button key={houseKey} className={`hpvn-house ${selectedHouse === houseKey ? 'is-active' : ''}`}
                    style={{ ['--house' as string]: info.color }} onClick={() => setSelectedHouse(houseKey)} aria-pressed={selectedHouse === houseKey}>
                    <i aria-hidden="true">{info.token}</i>
                    <span>{info.name}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {selectedMode === 'SOLO' && (
          <section className="hpvn-field">
            <span className="lobby-label">Số bot đối thủ</span>
            <div className="hpvn-steps">
              {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                <button key={num} className={botCount === num ? 'is-active' : ''} onClick={() => handleBotCountChange(num)} aria-pressed={botCount === num}>{num}</button>
              ))}
            </div>
          </section>
        )}

        {/* Board Size Selector for Host */}
        {!isOnline && (
          <section className="hpvn-field">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span className="lobby-label">Kích thước bàn cờ (Chủ phòng chọn)</span>
              <span style={{ fontSize: '0.74rem', color: '#f3d189' }}>
                {selectedMode === 'SOLO' ? `Tổng ${botCount + 1} người chơi` : 'Chế độ 4 người'}
              </span>
            </div>
            <div className="board-size-options" role="radiogroup" aria-label="Kích thước bàn cờ">
              {BOARD_SIZE_PRESETS.map((preset) => {
                const isSelected = boardSize === preset.size;
                const isRecommended = preset.size === recommendedSize;
                return (
                  <button
                    key={preset.size}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    className={`board-size-card ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => setBoardSize(preset.size)}
                  >
                    <div className="board-size-head">
                      <span className="board-size-icon">{preset.icon}</span>
                      {isRecommended && (
                        <span className="board-size-badge-rec">{preset.recLabel}</span>
                      )}
                    </div>
                    <div className="board-size-title">{preset.title}</div>
                    <div className="board-size-desc">{preset.target}</div>
                    <div className="board-size-meta">
                      <span>{preset.tilesCount} ô đất</span>
                      <span>{preset.time}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {selectedMode === 'ONLINE_HOST' && (
          <label className={`hpvn-stake-toggle ${stake ? 'is-on' : ''}`}>
            <span className="hpvn-stake-text">
              <strong>Cược 5.000 Galleons thật</strong>
              <small>Mỗi người đặt 5.000 Galleons khi bắt đầu; người thắng nhận cả quỹ (5.000 × số người). Không có bot; thoát giữa ván là mất cược.</small>
            </span>
            <input type="checkbox" role="switch" aria-checked={stake} checked={stake} onChange={(e) => setStake(e.target.checked)} />
            <span className="hpvn-switch" aria-hidden="true" />
          </label>
        )}
        {selectedMode === 'ONLINE_HOST' && (
          <p className="hpvn-hint">Máy chủ HPVN tạo mã phòng 6 ký tự. Mời bạn bè qua Mạng Floo; mỗi người vào bằng tài khoản của mình, quân cờ theo Nhà trong hồ sơ.</p>
        )}

        {selectedMode === 'ONLINE_JOIN' && (
          <label className="hpvn-field">
            <span className="lobby-label">Mã phòng</span>
            <input className="lobby-text-input hpvn-code" value={joinCodeInput}
              onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              placeholder="HGW7K2" maxLength={6} autoCapitalize="characters" autoComplete="off" />
          </label>
        )}

        {(error || notice) && <div className="hpvn-notice" role="alert">{error || notice}</div>}

        <button className="btn-launch-game" onClick={handleLaunch} disabled={busy}>
          {busy ? 'Đang kết nối…' : selectedMode === 'ONLINE_HOST' ? 'Tạo phòng' : selectedMode === 'ONLINE_JOIN' ? 'Vào phòng' : 'Bắt đầu ván đấu'}
        </button>
      </div>
    </div>
  );
};
