import React, { useState, useEffect, useRef } from 'react';
import { CardConfig, Player } from '../core/types';
import { soundManager } from '../audio/soundManager';
import { diceClock } from '../render/Board3DDice';
import './ActiveCardModal.css';
import { g, galleons } from '../hpvn/money';

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
  const cardRef = useRef<HTMLDivElement>(null);
  // App passes a new onDismiss each render; a ref keeps the bot timer from restarting.
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;
  // The card waits for the dice to land, so it never covers them mid-roll.
  const [shownId, setShownId] = useState<string | null>(null);
  useEffect(() => {
    if (!card) return setShownId(null);
    const wait = Math.max(0, diceClock.settleAt - performance.now()) + 250;
    const timer = setTimeout(() => setShownId(card.id), wait);
    return () => clearTimeout(timer);
  }, [card?.id]);
  const shown = !!card && shownId === card.id;

  // Auto-flip with snappy suspense
  useEffect(() => {
    setIsFlipped(false);
    if (!shown) return;
    const flipTimer = setTimeout(() => {
      setIsFlipped(true);
      soundManager.playSpellCard();
    }, turboMode ? 250 : 500);

    return () => clearTimeout(flipTimer);
  }, [shown, card?.id, player?.isAI, turboMode]);

  // Auto-dismiss for AI players, long enough to read the flipped card
  useEffect(() => {
    if (!shown || !player?.isAI) return;
    const dismissTime = turboMode ? 1200 : 2400;
    const aiTimer = setTimeout(() => {
      dismissRef.current();
    }, dismissTime);
    return () => clearTimeout(aiTimer);
  }, [shown, card?.id, player?.isAI, turboMode]);

  // Keyboard shortcut: Space or Enter to dismiss
  useEffect(() => {
    if (!shown) return;
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
  }, [shown, isFlipped, onDismiss]);

  if (!card || !shown) return null;

  const isCharms = card.id.startsWith('c-');
  const baseUrl = import.meta.env.BASE_URL || '/';

  // Art mapping
  const cardBackPath = isCharms
    ? `${baseUrl}assets/cards/card_back_charms.webp?v=unified_master`
    : `${baseUrl}assets/cards/card_back_potions.webp?v=unified_master`;

  const getCardArtPath = () => {
    switch (card.id) {
      case 'c-1': return `${baseUrl}assets/cards/tile_0.webp`;
      case 'c-2': return `${baseUrl}assets/cards/tile_9.webp`;
      case 'c-3': return `${baseUrl}assets/cards/tile_34.webp`;
      case 'c-4': return `${baseUrl}assets/cards/tile_30.webp`;
      case 'c-5': return `${baseUrl}assets/cards/art_golden_snitch.webp`;
      case 'c-6': return `${baseUrl}assets/cards/tile_10.webp`;
      case 'c-7': return `${baseUrl}assets/cards/tile_26.webp`;
      case 'c-8': return `${baseUrl}assets/cards/art_golden_snitch.webp`;

      case 'p-1': return `${baseUrl}assets/cards/art_felix_felicis.webp`;
      case 'p-2': return `${baseUrl}assets/cards/tile_2.webp`;
      case 'p-3': return `${baseUrl}assets/cards/tile_26.webp`;
      case 'p-4': return `${baseUrl}assets/cards/tile_30.webp`;
      case 'p-5': return `${baseUrl}assets/cards/art_felix_felicis.webp`;
      case 'p-6': return `${baseUrl}assets/cards/art_felix_felicis.webp`;
      case 'p-7': return `${baseUrl}assets/cards/tile_2.webp`;
      case 'p-8': return `${baseUrl}assets/cards/tile_10.webp`;
      default:
        return isCharms
          ? `${baseUrl}assets/cards/tile_7.webp`
          : `${baseUrl}assets/cards/tile_2.webp`;
    }
  };

  // Fallback background gradient for when images don't load
  const fallbackGradient = isCharms
    ? 'linear-gradient(135deg, #4c1d95 0%, #7c3aed 50%, #a78bfa 100%)'
    : 'linear-gradient(135deg, #3b4704 0%, #047857 50%, #34d399 100%)';

  const getActionBadge = () => {
    switch (card.action) {
      case 'MONEY': {
        const amt = card.amount || 0;
        if (amt > 0) return { text: `+${galleons(amt)}`, cls: 'badge-pos' };
        return { text: `${galleons(amt)}`, cls: 'badge-neg' };
      }
      case 'MOVE':
        return { text: `Tiến ${card.amount || 0} ô`, cls: 'badge-move' };
      case 'MOVE_TO':
        return { text: `Đến ô chỉ định`, cls: 'badge-move' };
      case 'JAIL':
        return { text: `Vào Azkaban`, cls: 'badge-jail' };
      case 'GET_OUT_OF_JAIL':
        return { text: `Thẻ ra Azkaban`, cls: 'badge-gold' };
      case 'REPAIRS':
        return { text: `Phí sửa chữa`, cls: 'badge-neg' };
      case 'PAY_PLAYERS':
        return { text: `Nhận ${g(card.amount || 20)} từ mỗi người`, cls: 'badge-pos' };
      default:
        return { text: `Hiệu ứng đặc biệt`, cls: 'badge-neutral' };
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
                        <span className="pill-title">
              {isCharms ? 'Thẻ Bùa chú' : 'Thẻ Độc dược'}
            </span>
          </div>

          <div className="announcement-player">
            <span className="player-badge">
              {player?.name || 'Người chơi'} {player?.isAI && <span className="hpvn-bot">bot</span>}
            </span>
            <span className="player-sub">rút một lá</span>
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
                background: `radial-gradient(circle at ${glarePos.x}% ${glarePos.y}%, rgba(243, 209, 137, 0.35) 0%, rgba(243, 209, 137, 0.2) 30%, transparent 65%)`,
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
                <span className="hint-pulse">Nhấp để lật</span>
              </div>
            </div>

            {/* Front Face (Face Up) */}
            <div className={`active-card-side card-front-face ${isCharms ? 'front-charms' : 'front-potions'}`}>
              {/* Outer Golden Border & Runes */}
              <div className="card-front-inner-frame">
                {/* Header Tag */}
                <div className="card-front-header">
                  <span className="card-front-tag">
                    {isCharms ? 'Bùa chú' : 'Độc dược'}
                  </span>
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
              <span>Tiếp tục</span>
            </button>
          ) : (
            <button className="btn-active-card-dismiss human-btn" onClick={onDismiss}>
              <span>Đã hiểu <kbd className="hpvn-key">Space</kbd></span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
