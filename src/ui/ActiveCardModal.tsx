import React, { useState, useEffect, useRef } from 'react';
import { CardConfig, Player } from '../core/types';
import { soundManager } from '../audio/soundManager';
import './ActiveCardModal.css';

interface ActiveCardModalProps {
  card: CardConfig | null;
  player: Player | null;
  isMyTurn: boolean;
  onDismiss: () => void;
  turboMode?: boolean;
}

export const ActiveCardModal: React.FC<ActiveCardModalProps> = ({
  card,
  player,
  isMyTurn,
  onDismiss,
  turboMode = false,
}) => {
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [glarePos, setGlarePos] = useState({ x: 50, y: 50 });
  const [cardBackLoaded, setCardBackLoaded] = useState(false);
  const [cardFrontLoaded, setCardFrontLoaded] = useState(false);
  // For AI players, use short countdown matching auto-dismiss timing (700ms/1400ms)
  // For human players, use longer countdown (3s/5s)
  const initialCountdown = player?.isAI ? (turboMode ? 2 : 3) : (turboMode ? 3 : 5);
  const [countdown, setCountdown] = useState<number>(initialCountdown);
  const cardRef = useRef<HTMLDivElement>(null);

  // Auto-flip with snappy suspense
  useEffect(() => {
    setIsFlipped(false);
    const newCountdown = player?.isAI ? (turboMode ? 2 : 3) : (turboMode ? 3 : 5);
    setCountdown(newCountdown);

    const flipTimer = setTimeout(() => {
      setIsFlipped(true);
      soundManager.playSpellCard();
    }, turboMode ? 250 : 500);

    return () => clearTimeout(flipTimer);
  }, [card?.id, player?.isAI, turboMode]);

  // Snappy auto-dismiss for AI players (700ms in turbo, 1400ms normal)
  useEffect(() => {
    if (!card || !player?.isAI) return;
    // Calculate dismiss time based on turbo mode (matching countdown display)
    const dismissTime = turboMode ? 700 : 1400;
    const aiTimer = setTimeout(() => {
      onDismiss();
    }, dismissTime);
    return () => clearTimeout(aiTimer);
  }, [card?.id, player?.isAI, onDismiss, turboMode]);

  // Visual countdown timer - sync with auto-dismiss for AI
  useEffect(() => {
    if (!card) return;

    // For AI players, countdown syncs with auto-dismiss (fast countdown)
    // For human players, countdown is 1 second intervals
    const intervalTime = player?.isAI ? 500 : 1000; // Faster countdown for AI

    const interval = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, intervalTime);
    return () => clearInterval(interval);
  }, [card?.id, player?.isAI]);

  // Keyboard shortcut: Space or Enter to dismiss
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === 'Enter' || e.key === 'Escape') {
        if (!isFlipped) {
          setIsFlipped(true);
          soundManager.playSpellCard();
        } else {
          onDismiss();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFlipped, onDismiss]);

  if (!card) return null;

  const isCharms = card.id.startsWith('c-');
  const baseUrl = import.meta.env.BASE_URL || '/';

  // Art mapping
  const cardBackPath = isCharms
    ? `${baseUrl}assets/cards/card_back_charms.jpg?v=unified_master`
    : `${baseUrl}assets/cards/card_back_potions.jpg?v=unified_master`;

  const getCardArtPath = () => {
    switch (card.id) {
      case 'c-1': return `${baseUrl}assets/cards/tile_0.jpg`;
      case 'c-2': return `${baseUrl}assets/cards/tile_9.jpg`;
      case 'c-3': return `${baseUrl}assets/cards/tile_34.jpg`;
      case 'c-4': return `${baseUrl}assets/cards/tile_30.jpg`;
      case 'c-5': return `${baseUrl}assets/cards/art_golden_snitch.jpg`;
      case 'c-6': return `${baseUrl}assets/cards/tile_10.jpg`;
      case 'c-7': return `${baseUrl}assets/cards/tile_26.jpg`;
      case 'c-8': return `${baseUrl}assets/cards/art_golden_snitch.jpg`;

      case 'p-1': return `${baseUrl}assets/cards/art_felix_felicis.jpg`;
      case 'p-2': return `${baseUrl}assets/cards/tile_2.jpg`;
      case 'p-3': return `${baseUrl}assets/cards/tile_26.jpg`;
      case 'p-4': return `${baseUrl}assets/cards/tile_30.jpg`;
      case 'p-5': return `${baseUrl}assets/cards/art_felix_felicis.jpg`;
      case 'p-6': return `${baseUrl}assets/cards/art_felix_felicis.jpg`;
      case 'p-7': return `${baseUrl}assets/cards/tile_2.jpg`;
      case 'p-8': return `${baseUrl}assets/cards/tile_10.jpg`;
      default:
        return isCharms
          ? `${baseUrl}assets/cards/tile_7.jpg`
          : `${baseUrl}assets/cards/tile_2.jpg`;
    }
  };

  // Fallback background gradient for when images don't load
  const fallbackGradient = isCharms
    ? 'linear-gradient(135deg, #4c1d95 0%, #7c3aed 50%, #a78bfa 100%)'
    : 'linear-gradient(135deg, #064e3b 0%, #047857 50%, #34d399 100%)';

  const getActionBadge = () => {
    switch (card.action) {
      case 'MONEY': {
        const amt = card.amount || 0;
        if (amt > 0) return { text: `+${amt} GALLEONS`, cls: 'badge-pos' };
        return { text: `${amt} GALLEONS`, cls: 'badge-neg' };
      }
      case 'MOVE':
        return { text: `TIẾN THÊM ${card.amount || 0} Ô`, cls: 'badge-move' };
      case 'MOVE_TO':
        return { text: `TIẾN VỀ Ô MỤC TIÊU`, cls: 'badge-move' };
      case 'JAIL':
        return { text: `BỊ GIẢI ĐẾN AZKABAN`, cls: 'badge-jail' };
      case 'GET_OUT_OF_JAIL':
        return { text: `THẺ MIỄN GIAM AZKABAN`, cls: 'badge-gold' };
      case 'REPAIRS':
        return { text: `CHI PHÍ BẢO DƯỠNG`, cls: 'badge-neg' };
      case 'PAY_PLAYERS':
        return { text: `MỖI NGƯỜI CHƠI TẶNG ${card.amount || 20} G`, cls: 'badge-pos' };
      default:
        return { text: `HIỆU ỨNG PHÉP THUẬT`, cls: 'badge-neutral' };
    }
  };

  const badge = getActionBadge();

  // Mouse Parallax
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotX = -((y - centerY) / centerY) * 12;
    const rotY = ((x - centerX) / centerX) * 12;

    setTilt({ x: rotX, y: rotY });
    setGlarePos({ x: (x / rect.width) * 100, y: (y / rect.height) * 100 });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
    setGlarePos({ x: 50, y: 50 });
  };

  const handleCardClick = () => {
    if (!isFlipped) {
      setIsFlipped(true);
      soundManager.playSpellCard();
    }
  };

  return (
    <div className="active-card-backdrop" onClick={onDismiss}>
      {/* Background Magic Dust & Particles */}
      <div className="magic-particles-layer" />

      <div className="active-card-container" onClick={(e) => e.stopPropagation()}>
        {/* Top Header Banner */}
        <div className={`active-card-announcement ${isCharms ? 'theme-charms' : 'theme-potions'}`}>
          <div className="announcement-pill">
            <span className="pill-sparkle">{isCharms ? '✨' : '🧪'}</span>
            <span className="pill-title">
              {isCharms ? 'RÚT THẺ BÙA CHÚ' : 'RÚT THẺ ĐỘC DƯỢC'}
            </span>
          </div>

          <div className="announcement-player">
            <span className="player-badge">
              {player?.name || 'Người chơi'} {player?.isAI ? '🤖' : '🧙'}
            </span>
            <span className="player-sub">đang kích hoạt phong ấn ma thuật</span>
          </div>
        </div>

        {/* 3D Flip Card Scene */}
        <div className="active-card-3d-scene" onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
          <div
            ref={cardRef}
            className={`active-card-flipper ${isFlipped ? 'flipped' : ''}`}
            onClick={handleCardClick}
            style={{
              transform: `perspective(1200px) rotateX(${tilt.x}deg) rotateY(${
                (isFlipped ? 180 : 0) + tilt.y
              }deg)`,
            }}
          >
            {/* Holographic Glare */}
            <div
              className="card-specular-glare"
              style={{
                background: `radial-gradient(circle at ${glarePos.x}% ${glarePos.y}%, rgba(255, 215, 0, 0.35) 0%, rgba(56, 189, 248, 0.2) 30%, transparent 65%)`,
              }}
            />

            {/* Back Face (Face Down) */}
            <div className="active-card-side card-back-face" style={{ background: !cardBackLoaded ? fallbackGradient : undefined }}>
              <img
                src={cardBackPath}
                alt="Card Back"
                className="card-back-img"
                onLoad={() => setCardBackLoaded(true)}
                onError={() => setCardBackLoaded(false)}
              />
              {!cardBackLoaded && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '3rem' }}>{isCharms ? '✨' : '🧪'}</span>
                </div>
              )}
              <div className="card-back-hint">
                <span className="hint-pulse">✨ Nhấp để lật bài</span>
              </div>
            </div>

            {/* Front Face (Face Up) */}
            <div className={`active-card-side card-front-face ${isCharms ? 'front-charms' : 'front-potions'}`}>
              {/* Outer Golden Border & Runes */}
              <div className="card-front-inner-frame">
                {/* Header Tag */}
                <div className="card-front-header">
                  <span className="card-front-tag">
                    {isCharms ? 'BÙA CHÚ HOGWARTS' : 'ĐỘC DƯỢC HẦM NGỤC'}
                  </span>
                  <span className="card-front-icon">{isCharms ? '⚡' : '⚗️'}</span>
                </div>

                {/* Central Art Vignette */}
                <div className="card-front-art-box">
                  {cardFrontLoaded ? (
                    <img src={getCardArtPath()} alt={card.title} className="card-front-art-img" />
                  ) : (
                    <div style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: fallbackGradient,
                      fontSize: '2.5rem'
                    }}>
                      {isCharms ? '✨' : '🧪'}
                    </div>
                  )}
                  <img
                    src={getCardArtPath()}
                    alt={card.title}
                    className="card-front-art-img"
                    style={{ display: 'none' }}
                    onLoad={() => setCardFrontLoaded(true)}
                    onError={() => setCardFrontLoaded(false)}
                  />
                  <div className="art-box-frame" />
                </div>

                {/* Card Title */}
                <h3 className="card-front-title">{card.title}</h3>

                {/* Card Description */}
                <p className="card-front-desc">{card.description}</p>

                {/* Action Badge */}
                <div className={`card-front-action-badge ${badge.cls}`}>
                  <span>{badge.text}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="active-card-actions">
          {player?.isAI ? (
            <button className="btn-active-card-dismiss ai-btn" onClick={onDismiss}>
              <span>⚡ Tiếp tục ({countdown}s)</span>
            </button>
          ) : (
            <button className="btn-active-card-dismiss human-btn" onClick={onDismiss}>
              <span>✨ Đã hiểu / Thực thi (Space)</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
