import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { TileConfig, Player, GameState } from '../core/types';
import { COLOR_GROUP_STYLES } from '../core/boardData';
import { calculateTakeoverCost } from '../core/rulesEngine';
import { getTileAssetId } from '../core/boardVariants';
import './CardInspectModal.css';
import { g, galleons } from '../hpvn/money';

interface CardInspectModalProps {
  tile: TileConfig | null;
  players: Player[];
  gameState?: GameState;
  onClose: () => void;
}

export const CardInspectModal: React.FC<CardInspectModalProps> = ({ tile, players, gameState, onClose }) => {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [glarePos, setGlarePos] = useState({ x: 50, y: 50 });
  const cardRef = useRef<HTMLDivElement>(null);

  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    setImageLoaded(false);
  }, [tile?.id, tile?.index]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!tile) return null;

  // Find owner of this tile from propertyOwnership first
  const ownerId = gameState?.propertyOwnership?.[tile.id];
  const owner = ownerId
    ? players.find((p) => p.id === ownerId)
    : players.find((p) => p.properties.includes(tile.id) || p.properties.includes(String(tile.index)));
  const isMortgaged = !!(gameState && gameState.mortgagedProperties[tile.id]);
  const houseCount = owner ? owner.houses[tile.id] || 0 : 0;
  const hasHotel = owner ? (owner.hotels[tile.id] || 0) > 0 : 0;
  const takeoverCost = owner && !isMortgaged ? calculateTakeoverCost(tile, owner) : 0;

  // Current active rent
  let currentRent = tile.baseRent || tile.rentTiers?.[0] || 0;
  if (isMortgaged) {
    currentRent = 0;
  } else if (hasHotel && tile.rentTiers && tile.rentTiers[5]) {
    currentRent = tile.rentTiers[5];
  } else if (houseCount > 0 && tile.rentTiers && tile.rentTiers[houseCount]) {
    currentRent = tile.rentTiers[houseCount];
  }

  // Determine district badge & color
  const colorStyle = tile.colorGroup ? COLOR_GROUP_STYLES[tile.colorGroup] : null;
  const baseUrl = import.meta.env.BASE_URL || '/';
  const assetId = getTileAssetId(tile);
  const cardImagePath = `${baseUrl}assets/cards/tile_${assetId}.webp?v=unified_master`;

  // 3D Card Interactive Mouse Parallax Handler
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotX = -((y - centerY) / centerY) * 16;
    const rotY = ((x - centerX) / centerX) * 16;

    setTilt({ x: rotX, y: rotY });
    setGlarePos({ x: (x / rect.width) * 100, y: (y / rect.height) * 100 });
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!cardRef.current || e.touches.length === 0) return;
    const touch = e.touches[0];
    const rect = cardRef.current.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotX = -((y - centerY) / centerY) * 16;
    const rotY = ((x - centerX) / centerX) * 16;

    setTilt({ x: rotX, y: rotY });
    setGlarePos({ x: (x / rect.width) * 100, y: (y / rect.height) * 100 });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
    setGlarePos({ x: 50, y: 50 });
  };

  return createPortal(
    <div className="card-modal-backdrop" onClick={onClose}>
      <div className="card-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Close Button */}
        <button className="card-modal-close-btn" onClick={onClose} title="Đóng · Esc" aria-label="Đóng">
          ✕
        </button>

        {/* Left Column: 3D Holographic Card View */}
        <div className="card-modal-3d-stage">
          <div
            ref={cardRef}
            className="card-3d-slab"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleMouseLeave}
            style={{
              transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale3d(1.02, 1.02, 1.02)`,
            }}
          >
            {/* Holographic Glare Overlay */}
            <div
              className="card-holographic-glare"
              style={{
                background: `radial-gradient(circle at ${glarePos.x}% ${glarePos.y}%, rgba(226, 184, 102, 0.45) 0%, rgba(243, 209, 137, 0.15) 30%, transparent 65%)`,
              }}
            />

            {/* Glowing Cyber-Cyan Neon Perimeter */}
            <div className="card-neon-perimeter" />

            {/* Card Face Content */}
            <div className="card-face-content">
              {/* Card Illustration Image */}
              <img
                src={cardImagePath}
                alt={tile.name}
                className="card-photo-img"
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageLoaded(false)}
                style={{
                  display: imageLoaded ? 'block' : 'none',
                  position: 'relative',
                  zIndex: 3,
                }}
              />

              {/* Procedural Backup Header & Art when image is not present */}
              {!imageLoaded && (
                <div className="card-procedural-layout">
                  <div
                    className="card-procedural-header"
                    style={{ borderLeftColor: colorStyle?.bg || '#f3d189' }}
                  >
                    <span className="card-proc-sub">
                      {colorStyle?.name || tile.type.replace(/_/g, ' ')}
                    </span>
                    <h3 className="card-proc-title">{tile.name}</h3>
                  </div>

                  <div className="card-proc-arch">
                    <span className="card-proc-icon">{tile.icon || '⚡'}</span>
                  </div>

                  {tile.price && (
                    <div className="card-proc-price-plaque">
                      
                      <span className="price-val">{tile.price} GALLEONS</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="card-3d-hint">
            <span>Rê chuột trên lá bài để xoay</span>
          </div>
        </div>

        {/* Right Column: Magical Deed Dossier & Financial Lore */}
        <div className="card-modal-dossier">
          {/* Header & Badges */}
          <div className="dossier-header">
            <div className="dossier-badges">
              {colorStyle && (
                <span
                  className="dossier-group-badge"
                  style={{ backgroundColor: colorStyle.bg, color: colorStyle.text }}
                >
                  {colorStyle.name}
                </span>
              )}
              <span className="dossier-type-badge">
                {tile.type === 'PROPERTY' ? 'Bất động sản' : tile.type === 'STATION' ? 'Nhà ga' : 'Địa danh'}
              </span>
            </div>
            <h2 className="dossier-title">{tile.name}</h2>
            <p className="dossier-desc">{tile.description || `Địa danh lịch sử trong thế giới phù thủy Harry Potter.`}</p>
          </div>

          {/* Owner Status Banner */}
          <div
            className={`dossier-owner-banner ${owner ? 'is-claimed' : 'is-unclaimed'}`}
            style={owner ? { borderColor: owner.color, boxShadow: `0 0 20px ${owner.color}33` } : undefined}
          >
            <div className="owner-banner-header">
              <span className="owner-label">Chủ sở hữu</span>
              {owner ? (
                <span className="owner-badge-tag" style={{ backgroundColor: isMortgaged ? '#ef4444' : owner.color }}>
                  {isMortgaged ? 'Đang thế chấp' : 'Đã có chủ'}
                </span>
              ) : tile.price ? (
                <span className="owner-badge-tag unowned">Chưa có chủ</span>
              ) : (
                <span className="owner-badge-tag public">Khu công cộng</span>
              )}
            </div>

            {owner ? (
              <div className="owner-info-body">
                <div className="owner-name-row">
                  <span className="owner-token-icon">{owner.tokenIcon || '👑'}</span>
                  <span className="owner-name-txt" style={{ color: owner.color }}>
                    <strong>{owner.name}</strong> ({owner.house})
                  </span>
                </div>
                {isMortgaged ? (
                  <div className="owner-rent-warning" style={{ color: '#f87171' }}>
                    Đất đang thế chấp: khách dừng chân <strong>không phải trả tiền</strong>.
                  </div>
                ) : (
                  <>
                    <div className="owner-rent-warning">
                      Tiền thuê hiện tại: <strong>{galleons(currentRent)}</strong>{' '}
                      {hasHotel ? '(1 lâu đài)' : houseCount > 0 ? `(${houseCount} túp lều)` : '(đất trống)'}
                    </div>
                    {hasHotel ? (
                      <div className="owner-rent-warning" style={{ color: '#f59e0b', marginTop: '6px' }}>
                        🏰 <strong>Lâu Đài Kiên Cố:</strong> Bất khả xâm phạm (Không thể bị mua đứt).
                      </div>
                    ) : takeoverCost > 0 ? (
                      <div className="owner-rent-warning" style={{ color: '#f472b6', marginTop: '6px' }}>
                        Giá mua đứt (x2): <strong>{galleons(takeoverCost)}</strong>{' '}
                        <span style={{ fontSize: '0.72rem', color: '#bb9c7c' }}>(dừng chân ở đây để thâu tóm)</span>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            ) : tile.price ? (
              <div className="unowned-info-body">
                <p>Địa danh này hiện đang mở cho mọi phù thủy xác lập quyền sở hữu.</p>
                <span className="unowned-buy-hint">
                  Giá niêm yết: <strong>{galleons(tile.price)}</strong> · dừng chân ở đây để mua hoặc đấu giá.
                </span>
              </div>
            ) : (
              <div className="public-info-body">
                <p>Khu vực chung thuộc quyền quản lý của lâu đài Hogwarts và Bộ Pháp Thuật.</p>
              </div>
            )}
          </div>

          {/* Financial Rent Table */}
          {tile.rentTiers && tile.rentTiers.length > 0 && (
            <div className="dossier-rent-table">
              <h4 className="rent-table-title">Bảng tiền thuê</h4>
              <div className="rent-grid">
                <div className="rent-row">
                  <span className="rent-label">Thuê đất trống:</span>
                  <span className="rent-num">{g(tile.baseRent || tile.rentTiers[0])}</span>
                </div>
                {tile.rentTiers[1] && (
                  <div className="rent-row">
                    <span className="rent-label">1 túp lều:</span>
                    <span className="rent-num">{g(tile.rentTiers[1])}</span>
                  </div>
                )}
                {tile.rentTiers[2] && (
                  <div className="rent-row">
                    <span className="rent-label">2 túp lều:</span>
                    <span className="rent-num">{g(tile.rentTiers[2])}</span>
                  </div>
                )}
                {tile.rentTiers[3] && (
                  <div className="rent-row">
                    <span className="rent-label">3 túp lều:</span>
                    <span className="rent-num">{g(tile.rentTiers[3])}</span>
                  </div>
                )}
                {tile.rentTiers[4] && (
                  <div className="rent-row">
                    <span className="rent-label">4 túp lều:</span>
                    <span className="rent-num">{g(tile.rentTiers[4])}</span>
                  </div>
                )}
                {tile.rentTiers[5] && (
                  <div className="rent-row highlight-castle">
                    <span className="rent-label">Lâu đài:</span>
                    <span className="rent-num gold">{g(tile.rentTiers[5])}</span>
                  </div>
                )}
              </div>

              {/* Development & Mortgage info */}
              <div className="dossier-costs-footer">
                {tile.houseCost && (
                  <div className="cost-item">
                    <span className="cost-label">Chi phí xây nhà:</span>
                    <span className="cost-val">{galleons(tile.houseCost)} / căn</span>
                  </div>
                )}
                {tile.mortgageValue && (
                  <div className="cost-item">
                    <span className="cost-label">Giá trị thế chấp:</span>
                    <span className="cost-val">{galleons(tile.mortgageValue)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Footer */}
          <div className="dossier-actions">
            <button className="dossier-close-btn" onClick={onClose}>
              Đóng <kbd className="hpvn-key">Esc</kbd>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
