import React, { useState } from 'react';
import { HouseType } from '../core/types';
import { HOUSE_INFO } from '../core/boardData';
import { generateRoomCode } from '../network/peerManager';
import './Lobby.css';

export type GameSetupConfig =
  | { mode: 'SOLO'; playerName: string; playerHouse: HouseType; botCount: number }
  | { mode: 'HOTSEAT'; players: Array<{ name: string; house: HouseType; isAI: boolean }> }
  | { mode: 'ONLINE_HOST'; playerName: string; playerHouse: HouseType; roomCode: string; maxPlayers: number }
  | { mode: 'ONLINE_JOIN'; playerName: string; playerHouse: HouseType; roomCode: string };

interface LobbyProps {
  onStartGame: (config: GameSetupConfig) => void;
}

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

export const Lobby: React.FC<LobbyProps> = ({ onStartGame }) => {
  const [selectedMode, setSelectedMode] = useState<'SOLO' | 'ONLINE_HOST' | 'ONLINE_JOIN' | 'HOTSEAT'>('SOLO');
  const [playerName, setPlayerName] = useState('Harry Potter');
  const [selectedHouse, setSelectedHouse] = useState<HouseType>('Gryffindor');
  const [botCount, setBotCount] = useState<number>(3);
  const [roomCode, setRoomCode] = useState<string>(() => generateRoomCode());
  const [joinCodeInput, setJoinCodeInput] = useState<string>('');

  const handleLaunch = () => {
    if (selectedMode === 'SOLO') {
      onStartGame({
        mode: 'SOLO',
        playerName: playerName.trim() || 'Người chơi 1',
        playerHouse: selectedHouse,
        botCount,
      });
    } else if (selectedMode === 'ONLINE_HOST') {
      onStartGame({
        mode: 'ONLINE_HOST',
        playerName: playerName.trim() || 'Chủ Phòng',
        playerHouse: selectedHouse,
        roomCode: roomCode.toUpperCase(),
        maxPlayers: 8,
      });
    } else if (selectedMode === 'ONLINE_JOIN') {
      if (!joinCodeInput.trim()) {
        alert('Vui lòng nhập Mã Phòng để tham gia!');
        return;
      }
      onStartGame({
        mode: 'ONLINE_JOIN',
        playerName: playerName.trim() || 'Khách',
        playerHouse: selectedHouse,
        roomCode: joinCodeInput.trim().toUpperCase(),
      });
    } else if (selectedMode === 'HOTSEAT') {
      // 4 local players
      const hotseatPlayers = [
        { name: 'Harry Potter', house: 'Gryffindor' as HouseType, isAI: false },
        { name: 'Draco Malfoy', house: 'Slytherin' as HouseType, isAI: false },
        { name: 'Luna Lovegood', house: 'Ravenclaw' as HouseType, isAI: false },
        { name: 'Cedric Diggory', house: 'Hufflepuff' as HouseType, isAI: false },
      ];
      onStartGame({ mode: 'HOTSEAT', players: hotseatPlayers });
    }
  };

  return (
    <div className="lobby-overlay">
      <div className="lobby-modal-card">
        <div className="lobby-header-center">
          <div className="lobby-title">⚡ HOGWARTS 3D MONOPOLY ⚡</div>
          <div className="lobby-subtitle">Giải Đấu Cờ Tỷ Phú Thế Giới Phù Thủy • Luật 30 Phút</div>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            marginTop: '6px',
            padding: '3px 10px',
            borderRadius: '999px',
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#34d399',
            fontSize: '0.75rem',
            fontWeight: 600,
            letterSpacing: '0.5px'
          }}>
            <span style={{ display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }} />
            Máy Chủ Multiplayer: Supabase Realtime (7-Potters & Undercover)
          </div>
        </div>

        {/* Mode Selector */}
        <div className="mode-selector-grid">
          <div
            className={`mode-card-pill ${selectedMode === 'SOLO' ? 'active' : ''}`}
            onClick={() => setSelectedMode('SOLO')}
          >
            <span className="mode-icon">🤖</span>
            <span className="mode-name">Solo vs Bot AI</span>
          </div>

          <div
            className={`mode-card-pill ${selectedMode === 'ONLINE_HOST' ? 'active' : ''}`}
            onClick={() => setSelectedMode('ONLINE_HOST')}
          >
            <span className="mode-icon">🌐</span>
            <span className="mode-name">Tạo Phòng Online</span>
          </div>

          <div
            className={`mode-card-pill ${selectedMode === 'ONLINE_JOIN' ? 'active' : ''}`}
            onClick={() => setSelectedMode('ONLINE_JOIN')}
          >
            <span className="mode-icon">🔑</span>
            <span className="mode-name">Vào Phòng Online</span>
          </div>
        </div>

        {/* Player Name */}
        <div className="lobby-input-group">
          <label className="lobby-label">Tên Pháp Sư Của Bạn</label>
          <input
            className="lobby-text-input"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Nhập tên của bạn..."
            maxLength={20}
          />
        </div>

        {/* House Selection */}
        <div className="lobby-input-group">
          <label className="lobby-label">Chọn Nhà / Phe Phái Hogwarts</label>
          <div className="house-grid-picker">
            {AVAILABLE_HOUSES.map((houseKey) => {
              const info = HOUSE_INFO[houseKey];
              const isSelected = selectedHouse === houseKey;
              return (
                <div
                  key={houseKey}
                  className={`house-pick-item ${isSelected ? 'selected' : ''}`}
                  style={{
                    borderColor: isSelected ? info.color : 'rgba(255,255,255,0.1)',
                    background: isSelected ? `${info.color}22` : undefined,
                  }}
                  onClick={() => setSelectedHouse(houseKey)}
                >
                  <div style={{ fontSize: '1.4rem' }}>{info.token}</div>
                  <div style={{ fontWeight: 700, marginTop: '4px' }}>{info.name}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Mode Specific Settings */}
        {selectedMode === 'SOLO' && (
          <div className="lobby-input-group">
            <label className="lobby-label">Số Lượng Bot AI Đối Thủ (1 - 7)</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[1, 2, 3, 5, 7].map((num) => (
                <button
                  key={num}
                  className={`tab-btn ${botCount === num ? 'active' : ''}`}
                  style={{ flex: 1, padding: '10px', borderRadius: '8px' }}
                  onClick={() => setBotCount(num)}
                >
                  {num} Bot
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedMode === 'ONLINE_HOST' && (
          <div className="lobby-input-group">
            <label className="lobby-label">Mã Phòng Tự Động Tạo (Chia Sẻ Cho Bạn Bè)</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                className="lobby-text-input"
                style={{ flex: 1, letterSpacing: '4px', fontWeight: 800, textAlign: 'center', fontSize: '1.2rem', color: '#00f2fe' }}
                value={roomCode}
                readOnly
              />
              <button
                className="btn-bid"
                style={{ padding: '0 16px' }}
                onClick={() => setRoomCode(generateRoomCode())}
              >
                Đổi mã
              </button>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '6px' }}>
              ℹ️ Phòng được đồng bộ thời gian thực qua máy chủ Supabase WebSocket. Bạn bè có thể nhập mã này trên điện thoại hoặc máy tính để cùng chơi.
            </div>
          </div>
        )}

        {selectedMode === 'ONLINE_JOIN' && (
          <div className="lobby-input-group">
            <label className="lobby-label">Nhập 4 Ký Tự Mã Phòng Của Bạn Bè</label>
            <input
              className="lobby-text-input"
              style={{ letterSpacing: '4px', fontWeight: 800, textAlign: 'center', fontSize: '1.2rem', color: '#ffd700' }}
              value={joinCodeInput}
              onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
              placeholder="VD: HOGW"
              maxLength={6}
            />
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '6px' }}>
              ℹ️ Kết nối trực tiếp vào phòng đấu qua máy chủ Supabase. Toàn bộ thao tác sẽ đồng bộ ngay lập tức.
            </div>
          </div>
        )}

        {/* Launch Button */}
        <button className="btn-launch-game" onClick={handleLaunch}>
          ⚡ BẮT ĐẦU VÁN ĐẤU
        </button>
      </div>
    </div>
  );
};
