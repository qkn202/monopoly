import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameState, GameAction, HouseType, Player } from './core/types';
import { createInitialState, gameReducer } from './core/gameReducer';
import { getBotAction } from './core/botAI';
import { HOGWARTS_TILES, HOUSE_INFO } from './core/boardData';
import { startHostSession, startGuestSession, HostSession, GuestSession } from './network/peerManager';
import { BoardThreeJS } from './ui/BoardThreeJS';
import { RightSidebar } from './ui/RightSidebar';
import { ActiveCardModal } from './ui/ActiveCardModal';
import { DarkCurseModal } from './ui/DarkCurseModal';
import { Lobby, GameSetupConfig } from './ui/Lobby';
import { soundManager } from './audio/soundManager';
import './App.css';

export function App() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [inLobby, setInLobby] = useState<boolean>(true);
  const [roomCode, setRoomCode] = useState<string | undefined>(undefined);
  const [myPlayerId, setMyPlayerId] = useState<string | undefined>(undefined);

  const hostSessionRef = useRef<HostSession | null>(null);
  const guestSessionRef = useRef<GuestSession | null>(null);
  const isHostRef = useRef<boolean>(true);
  // Track guest sender ID to assigned player ID mapping for security
  const guestToPlayerMapRef = useRef<Record<string, string>>({});

  // Central Dispatcher
  const dispatch = useCallback((action: GameAction) => {
    if (isHostRef.current) {
      setGameState((prev) => {
        if (!prev) return null;
        const next = gameReducer(prev, action);
        // Broadcast to connected online peers
        hostSessionRef.current?.broadcastState(next);
        return next;
      });
    } else {
      // Guest sends action to host
      guestSessionRef.current?.sendAction(action);
    }
  }, []);

  useEffect(() => {
    (window as any).__dispatch = dispatch;
    (window as any).__setGameState = setGameState;
    (window as any).__gameState = gameState;
    (window as any).__gameReducer = gameReducer;
  }, [dispatch, gameState]);

  // 1. Handle Start Game from Lobby
  const handleStartGame = async (config: GameSetupConfig) => {
    if (config.mode === 'SOLO') {
      isHostRef.current = true;
      const botHouses: HouseType[] = ['Slytherin', 'Ravenclaw', 'Hufflepuff', 'Auror', 'DeathEater', 'OrderOfPhoenix', 'Ministry'];
      const botNames = ['Draco Malfoy', 'Luna Lovegood', 'Cedric Diggory', 'Severus Snape', 'Bellatrix Lestrange', 'Sirius Black', 'Alastor Moody'];

      const players = [
        { name: config.playerName, house: config.playerHouse, isAI: false },
        ...Array.from({ length: config.botCount }, (_, i) => ({
          name: botNames[i % botNames.length],
          house: botHouses[i % botHouses.length],
          isAI: true,
        })),
      ];

      const initial = createInitialState(players);
      setGameState(initial);
      setMyPlayerId(initial.players[0].id);
      setInLobby(false);
    } else if (config.mode === 'ONLINE_HOST') {
      isHostRef.current = true;
      setRoomCode(config.roomCode);

      const hostPlayer = { name: config.playerName, house: config.playerHouse, isAI: false };
      const initial = createInitialState([hostPlayer]);
      setGameState(initial);
      setMyPlayerId(initial.players[0].id);
      setInLobby(false);

      try {
        const session = await startHostSession(
          config.roomCode,
          (conn, guestData) => {
            // New guest joined!
            setGameState((prev) => {
              if (!prev) return null;
              const newPlayerId = `p-${prev.players.length}`;
              const houseInfo = HOUSE_INFO[guestData.house] || { color: '#38bdf8', token: '⚡' };
              const guestPlayer: Player = {
                id: newPlayerId,
                name: guestData.playerName,
                house: guestData.house,
                color: houseInfo.color,
                tokenIcon: houseInfo.token,
                balance: 5000,
                position: 0,
                properties: [],
                inJail: false,
                jailTurnsRemaining: 0,
                getOutOfJailCards: 0,
                isBankrupt: false,
                isAI: false,
                houses: {},
                hotels: {},
                netWorth: 5000,
              };

              // Track guest-to-player mapping for security
              guestToPlayerMapRef.current[conn.id] = newPlayerId;

              const updatedState: GameState = {
                ...prev,
                players: [...prev.players, guestPlayer],
              };

              conn.send({
                type: 'JOIN_ACCEPTED',
                targetGuestId: conn.id,
                assignedPlayerId: newPlayerId,
                playerId: newPlayerId,
                initialGameState: updatedState,
              });

              session.broadcastState(updatedState);
              return updatedState;
            });
          },
          (action: any, senderId: string) => {
            // Security: Verify guest action is for the correct player
            const assignedPlayerId = guestToPlayerMapRef.current[senderId];
            if (assignedPlayerId && gameState) {
              const currentPlayer = gameState.players[gameState.currentPlayerIndex];
              // Only dispatch if it's this player's turn and matches sender
              if (currentPlayer && currentPlayer.id === assignedPlayerId) {
                // Remove security metadata before dispatching
                const cleanAction = { ...action };
                delete cleanAction._verifiedPlayerId;
                delete cleanAction._senderId;
                dispatch(cleanAction);
              } else {
                console.warn(`[Host] Rejected guest action: sender ${senderId} tried action for player ${assignedPlayerId} but it's ${currentPlayer?.id}'s turn`);
              }
            } else {
              // Should not happen - guest should always have mapping
              console.warn(`[Host] Received action from unknown guest: ${senderId}`);
            }
          },
          () => {
            console.log('Guest left');
          }
        );
        hostSessionRef.current = session;
      } catch (err) {
        console.error('Failed to create host room:', err);
        alert('Không thể tạo phòng Online. Đang chuyển về chế độ Offline.');
      }
    } else if (config.mode === 'ONLINE_JOIN') {
      isHostRef.current = false;
      setRoomCode(config.roomCode);

      try {
        const session = await startGuestSession(
          config.roomCode,
          config.playerName,
          config.playerHouse,
          (syncedState) => {
            setGameState(syncedState);
          },
          (assignedPlayerId, initialState) => {
            setMyPlayerId(assignedPlayerId);
            setGameState(initialState);
            setInLobby(false);
          },
          () => {
            alert('Mất kết nối với Chủ Phòng.');
            setInLobby(true);
          }
        );
        guestSessionRef.current = session;
      } catch (err) {
        console.error('Failed to join room:', err);
        alert('Không tìm thấy phòng hoặc phòng đã đầy!');
      }
    } else if (config.mode === 'HOTSEAT') {
      isHostRef.current = true;
      const initial = createInitialState(config.players);
      setGameState(initial);
      setMyPlayerId(undefined); // Hotseat controls all
      setInLobby(false);
    }
  };

  // Keep latest gameState in ref so intervals and timeouts never get stale or reset prematurely
  const gameStateRef = useRef<GameState | null>(gameState);
  gameStateRef.current = gameState;

  // 2. 30-Minute Timer Interval & Auction Countdown
  useEffect(() => {
    if (!gameState || gameState.turnPhase === 'GAME_OVER' || inLobby) return;
    if (!isHostRef.current) return; // Only host ticks

    const timerInterval = setInterval(() => {
      const state = gameStateRef.current;
      if (!state || state.turnPhase === 'GAME_OVER') return;

      dispatch({ type: 'TIMER_TICK' });

      // If auction active, tick auction timer too
      if (state.auction && state.auction.active) {
        dispatch({ type: 'AUCTION_TICK' });
      }
    }, 1000);

    return () => clearInterval(timerInterval);
  }, [inLobby, gameState?.turnPhase === 'GAME_OVER', dispatch]);

  // Turn Countdown Audio Warning (Ticks during last 5 seconds, chime on timeout)
  const prevTurnSecRef = useRef<number>(60);
  useEffect(() => {
    if (!gameState || gameState.turnPhase === 'GAME_OVER' || inLobby) return;
    const curP = gameState.players[gameState.currentPlayerIndex];
    const isHumanTurn = curP && !curP.isAI && (!myPlayerId || curP.id === myPlayerId);

    const sec = gameState.turnSecondsRemaining ?? 60;
    if (isHumanTurn && sec <= 5 && sec > 0 && sec !== prevTurnSecRef.current) {
      soundManager.playTick();
    }
    if (prevTurnSecRef.current === 1 && sec === (gameState.maxTurnSeconds || 60)) {
      soundManager.playTimeoutAlert();
    }
    prevTurnSecRef.current = sec;
  }, [gameState?.turnSecondsRemaining, gameState?.currentPlayerIndex, myPlayerId, inLobby]);

  // Trigger Dark Curse Storm Audio when escalation event occurs
  const prevEscalationRef = useRef<number | null>(null);
  useEffect(() => {
    if (gameState?.activeEscalationEvent && gameState.activeEscalationEvent.timestamp !== prevEscalationRef.current) {
      prevEscalationRef.current = gameState.activeEscalationEvent.timestamp;
      soundManager.playDarkCurseStorm();
    }
  }, [gameState?.activeEscalationEvent]);

  // 3. Bot AI Auto-Play Runner (Host-only execution)
  useEffect(() => {
    if (!gameState || gameState.turnPhase === 'GAME_OVER' || inLobby) return;
    if (!isHostRef.current) return;

    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    const isBotTurn = currentPlayer?.isAI;
    const isAuctionBotBid =
      gameState.turnPhase === 'AUCTION' &&
      gameState.auction &&
      gameState.players.find(
        (p) => p.id === gameState.auction?.activeBidders[gameState.auction?.currentBidderIndex || 0]
      )?.isAI;

    if (isBotTurn || isAuctionBotBid) {
      const activeBot = isAuctionBotBid
        ? gameState.players.find(
            (p) => p.id === gameState.auction?.activeBidders[gameState.auction?.currentBidderIndex || 0]
          )
        : currentPlayer;

      if (!activeBot) return;

      // Pause bot actions while magic card popup is being presented
      if (gameState.activeCard) return;

      // Snappy bot thinking delay (120ms-350ms in Turbo, 350ms-900ms in Normal)
      const isRentTurn = isBotTurn && gameState.turnPhase === 'END_TURN' && !!gameState.lastRentPayment;
      const isTurbo = !!gameState.turboMode;
      const thinkingDelay = isTurbo
        ? (isRentTurn ? 350 : 120)
        : (isRentTurn ? 900 : 350);

      const aiTimer = setTimeout(() => {
        const botAction = getBotAction(gameState, activeBot);
        if (botAction) {
          dispatch(botAction);
        }
      }, thinkingDelay);

      return () => clearTimeout(aiTimer);
    }
  }, [gameState, inLobby, dispatch]);

  // 4. Global Quick Keyboard Shortcuts (Space: Roll/End Turn/Dismiss, B: Buy, P: Pass, T: Turbo)
  useEffect(() => {
    if (!gameState || gameState.turnPhase === 'GAME_OVER' || inLobby) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is currently typing in an input or textarea
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      // 'T' or 't' -> Toggle Turbo Speed Mode
      if (e.code === 'KeyT') {
        e.preventDefault();
        dispatch({ type: 'TOGGLE_TURBO' });
        return;
      }

      // If dark curse escalation modal is open -> Space/Enter/Escape dismisses it
      if (gameState.activeEscalationEvent) {
        if (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape') {
          e.preventDefault();
          dispatch({ type: 'DISMISS_ESCALATION' });
          return;
        }
      }

      // If active card modal is open -> let ActiveCardModal handle flip on 1st key and dismiss on 2nd key
      if (gameState.activeCard) {
        return;
      }

      const curP = gameState.players[gameState.currentPlayerIndex];
      const isHumanTurn = curP && !curP.isAI && (!myPlayerId || curP.id === myPlayerId);
      if (!isHumanTurn) return;

      // Spacebar -> Roll dice or End turn (or Skip hostile takeover)
      if (e.code === 'Space') {
        if (gameState.turnPhase === 'ROLL') {
          e.preventDefault();
          dispatch({ type: 'ROLL_DICE' });
        } else if (gameState.turnPhase === 'END_TURN') {
          e.preventDefault();
          dispatch({ type: 'END_TURN' });
        } else if (gameState.turnPhase === 'ACTION' && (gameState.takeoverCandidate || gameState.upgradeCandidate)) {
          e.preventDefault();
          dispatch({ type: 'PASS_PROPERTY' });
        }
      }

      // 'B' or 'b' -> Quick Buy, Hostile Takeover, or Upgrade Owned Property
      if (e.code === 'KeyB' && gameState.turnPhase === 'ACTION') {
        const tile = HOGWARTS_TILES[curP.position];
        if (gameState.upgradeCandidate && tile && tile.id === gameState.upgradeCandidate.propertyId) {
          if (curP.balance >= gameState.upgradeCandidate.cost) {
            e.preventDefault();
            if (gameState.upgradeCandidate.isHotelUpgrade) {
              dispatch({ type: 'BUILD_HOTEL', propertyId: tile.id, playerId: curP.id });
            } else {
              dispatch({ type: 'BUILD_HOUSE', propertyId: tile.id, playerId: curP.id });
            }
          }
        } else if (gameState.takeoverCandidate && tile && tile.id === gameState.takeoverCandidate.propertyId) {
          if (curP.balance >= gameState.takeoverCandidate.cost) {
            e.preventDefault();
            dispatch({ type: 'TAKEOVER_PROPERTY', propertyId: tile.id });
          }
        } else if (tile && tile.price && curP.balance >= tile.price && !gameState.propertyOwnership[tile.id]) {
          e.preventDefault();
          dispatch({ type: 'BUY_PROPERTY', propertyId: tile.id });
        }
      }

      // 'P' or 'p' -> Quick Pass (to Auction if unowned, or to END_TURN if takeover)
      if (e.code === 'KeyP' && gameState.turnPhase === 'ACTION') {
        e.preventDefault();
        dispatch({ type: 'PASS_PROPERTY' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, inLobby, myPlayerId, dispatch]);

  // Cleanup network on unmount
  useEffect(() => {
    return () => {
      hostSessionRef.current?.destroy();
      guestSessionRef.current?.destroy();
    };
  }, []);

  if (inLobby || !gameState) {
    return <Lobby onStartGame={handleStartGame} />;
  }

  const isGameOver = gameState.turnPhase === 'GAME_OVER';

  return (
    <div className="main-game-layout">
      {/* Left Stage: 3D Three.js Board (70-75% screen width) */}
      <main className="board-3d-stage">
        <BoardThreeJS gameState={gameState} />
      </main>

      {/* Right Stage: Fixed Control Sidebar (25-30% screen width) */}
      <RightSidebar
        gameState={gameState}
        dispatch={dispatch}
        roomCode={roomCode}
        myPlayerId={myPlayerId}
      />

      {/* Magic Active Card 3D Flip Modal */}
      {gameState.activeCard && (
        <ActiveCardModal
          card={gameState.activeCard}
          player={gameState.players[gameState.currentPlayerIndex]}
          isMyTurn={!myPlayerId || gameState.players[gameState.currentPlayerIndex]?.id === myPlayerId}
          onDismiss={() => dispatch({ type: 'DISMISS_CARD' })}
          turboMode={gameState.turboMode}
        />
      )}

      {/* Dark Curse Storm (Voldemort's Escalation) Modal */}
      {gameState.activeEscalationEvent && (
        <DarkCurseModal
          event={gameState.activeEscalationEvent}
          onDismiss={() => dispatch({ type: 'DISMISS_ESCALATION' })}
        />
      )}

      {/* Victory / Game Over Podium Modal */}
      {isGameOver && (
        <div className="game-over-overlay">
          <div className="victory-card">
            <div className="trophy-glow">🏆</div>
            <h2 style={{ fontSize: '1.2rem', color: '#38bdf8', letterSpacing: '2px' }}>
              KẾT THÚC GIẢI ĐẤU HOGWARTS
            </h2>
            <div className="winner-banner-name">{gameState.winner?.name || 'Nhà Vô Địch'}</div>
            <div style={{ color: '#ffd700', fontSize: '1.2rem', fontWeight: 700 }}>
              {gameState.winner?.house} {gameState.winner?.tokenIcon}
            </div>

            <div className="winner-meta-stats">
              <div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>TỔNG TÀI SẢN</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffd700' }}>
                  {gameState.winner?.netWorth.toLocaleString()} G
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>TIỀN MẶT</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#38bdf8' }}>
                  {gameState.winner?.balance.toLocaleString()} G
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>SỞ HỮU ĐẤT</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10b981' }}>
                  {gameState.winner?.properties.length} ô
                </div>
              </div>
            </div>

            <button
              className="btn-launch-game"
              style={{ marginTop: '12px' }}
              onClick={() => setInLobby(true)}
            >
              🔄 CHƠI VÁN MỚI
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
