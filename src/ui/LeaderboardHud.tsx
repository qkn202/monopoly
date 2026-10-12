import React, { useState } from 'react';
import { GameState } from '../core/types';
import { determineLeaderboard } from '../core/rulesEngine';
import { g } from '../hpvn/money';
import { Icon } from '../hpvn/Icon';
import './LeaderboardHud.css';

interface LeaderboardHudProps {
  gameState: GameState;
  myPlayerId?: string;
}

export const LeaderboardHud: React.FC<LeaderboardHudProps> = ({ gameState, myPlayerId }) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const leaderboard = determineLeaderboard(gameState);
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];

  return (
    <aside className={`board-leaderboard-hud ${isMinimized ? 'is-minimized' : ''}`} aria-label="Bảng điểm người chơi">
      <header className="hud-header">
        <div className="hud-title">
          <Icon name="trophy" size={13} />
          <span>BẢNG ĐIỂM</span>
        </div>
        <button
          className="hud-toggle-btn"
          onClick={() => setIsMinimized(!isMinimized)}
          title={isMinimized ? 'Mở rộng bảng điểm' : 'Thu nhỏ bảng điểm'}
          aria-label={isMinimized ? 'Mở rộng' : 'Thu nhỏ'}
        >
          {isMinimized ? '+' : '−'}
        </button>
      </header>

      {!isMinimized && (
        <div className="hud-player-list">
          {leaderboard.map((p, idx) => {
            const isTurn = p.id === currentPlayer?.id;
            const isMe = p.id === myPlayerId;
            const rankMedal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}`;

            return (
              <div
                key={p.id}
                className={`hud-player-row ${isTurn ? 'is-active-turn' : ''} ${isMe ? 'is-me' : ''} ${p.isBankrupt ? 'is-bankrupt' : ''}`}
              >
                <span className={`hud-rank rank-${idx + 1}`}>{rankMedal}</span>
                <div
                  className="player-avatar-circle mini-avatar"
                  style={{ borderColor: p.color, background: `${p.color}22` }}
                >
                  {p.tokenIcon}
                </div>
                <div className="hud-info">
                  <div className="hud-name-row">
                    <strong className="hud-name" title={p.name}>
                      {p.name}
                    </strong>
                    {isMe && <span className="hud-me-tag">Bạn</span>}
                    {p.isAI && <span className="hpvn-bot">bot</span>}
                    {p.inJail && <span className="hud-jail-tag" title="Đang ở Azkaban">Tù</span>}
                  </div>
                  <div className="hud-sub-stats">
                    <span className="hud-land" title={`${p.properties.length} ô đất`}>
                      {p.properties.length} ô
                    </span>
                    <span className="hud-dot">·</span>
                    <span className="hud-cash" title={`Tiền mặt: ${g(p.balance)}`}>
                      {g(p.balance)}
                    </span>
                  </div>
                </div>
                <div className="hud-worth">
                  <strong>{g(p.netWorth)}</strong>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
};
