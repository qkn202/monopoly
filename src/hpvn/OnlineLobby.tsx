import React, { useState } from 'react';
import { identity, request, RoomView } from './bridge';
import { MAX_SEATS } from './onlineGame';
import { g, galleons } from './money';
import '../ui/Lobby.css';

interface OnlineLobbyProps {
  room: RoomView;
  notice: string;
  waiting: boolean;
  onStart: (bots: number) => void;
  onLeave: () => void;
}

/** The HPVN room before a game: members from the server, bots and the start button for the host. */
export const OnlineLobby: React.FC<OnlineLobbyProps> = ({ room, notice, waiting, onStart, onLeave }) => {
  const isHost = room.hostUid === identity?.uid;
  const freeSeats = MAX_SEATS - room.members.length;
  const [bots, setBots] = useState(0);
  const [busy, setBusy] = useState(false);
  const [invited, setInvited] = useState('');
  // A staked room seats people only: no bots, and the start debits every seat.
  const staked = (room.stake ?? 0) > 0;
  const botCount = staked ? 0 : Math.min(bots, freeSeats);
  const last = room.stakeResult;
  const nameOf = (uid?: string) => room.members.find((m) => m.uid === uid)?.name ?? 'Một người chơi';

  const invite = () => {
    request('sb-invite').then(() => setInvited('Đã soạn lời mời trong Mạng Floo, bấm gửi để mời bạn bè.')).catch(() => setInvited('Chưa mở được Mạng Floo.'));
  };
  const start = async () => {
    setBusy(true);
    try { await onStart(botCount); } finally { setBusy(false); }
  };

  return (
    <div className="lobby-overlay">
      <div className="lobby-modal-card">
        <div className="lobby-header-center">
          <div className="lobby-title">Phòng {room.code}</div>
          <div className="lobby-subtitle">
            {waiting ? 'Đang vào ván…' : isHost ? 'Mời bạn bè vào phòng rồi bắt đầu ván' : 'Chờ chủ phòng bắt đầu ván'}
          </div>
        </div>

        {staked && (
          <section className="hpvn-stake-card" aria-label="Phòng cược">
            <strong>Phòng cược {galleons(room.stake!)} mỗi người</strong>
            <span>Quỹ nếu bắt đầu bây giờ: {galleons(room.stake! * room.members.length)} cho người thắng. Thoát giữa ván là mất cược; ván không có kết quả thì hoàn tiền cho tất cả.</span>
            {last && (
              <span className="hpvn-stake-last">
                Ván trước: {last.refunded ? `đã hoàn ${galleons(last.stake)} cho mọi người` : `${nameOf(last.winnerUid)} thắng ${galleons(last.pot ?? 0)}${last.held ? ' (chờ duyệt)' : ''}`}
              </span>
            )}
          </section>
        )}

        <div className="lobby-input-group">
          <label className="lobby-label">Phù thủy trong phòng ({room.members.length}/{MAX_SEATS})</label>
          <ul className="hpvn-member-list">
            {room.members.map((member) => (
              <li key={member.uid}>
                <span>{member.name}</span>
                {member.uid === room.hostUid && <span className="hpvn-member-tag">Chủ phòng</span>}
                {member.uid === identity?.uid && <span className="hpvn-member-tag">Bạn</span>}
              </li>
            ))}
          </ul>
        </div>

        {isHost && !waiting && freeSeats > 0 && !staked && (
          <div className="lobby-input-group">
            <label className="lobby-label">Thêm bot cho đủ bàn</label>
            <div className="hpvn-bot-row">
              {Array.from({ length: freeSeats + 1 }, (_, n) => (
                <button key={n} className={`tab-btn ${botCount === n ? 'active' : ''}`} onClick={() => setBots(n)}>
                  {n === 0 ? 'Không' : `${n} bot`}
                </button>
              ))}
            </div>
          </div>
        )}

        {notice && <div className="hpvn-notice" role="alert">{notice}</div>}
        {invited && <div className="hpvn-hint">{invited}</div>}

        {isHost && !waiting && (
          <button className="btn-launch-game" disabled={busy || room.members.length < 2} onClick={start}>
            {room.members.length < 2 ? 'Cần ít nhất 2 người trong phòng' : busy ? 'Đang chia chỗ…' : staked ? `Bắt đầu · cược ${g(room.stake!)}` : 'Bắt đầu ván đấu'}
          </button>
        )}
        <div className="hpvn-room-actions">
          {!waiting && <button className="btn-bid" onClick={invite}>Mời qua Mạng Floo</button>}
          <button className="btn-bid" onClick={onLeave}>{isHost ? 'Đóng phòng' : 'Rời phòng'}</button>
        </div>
      </div>
    </div>
  );
};
