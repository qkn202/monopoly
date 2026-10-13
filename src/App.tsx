import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameState, GameAction, HouseType, BankruptcyDetails } from './core/types';
import { createInitialState, gameReducer } from './core/gameReducer';
import { getBotAction } from './core/botAI';
import { HOGWARTS_TILES } from './core/boardData';
import { authorizeAction } from './core/actionAuth';
import { identity, onRoomEvent, post, request, roomOp, stamp, RoomView } from './hpvn/bridge';
import { packSnapshot, seatPlayers, unpackSnapshot } from './hpvn/onlineGame';
import { OnlineLobby } from './hpvn/OnlineLobby';
import { BoardThreeJS } from './ui/BoardThreeJS';
import { RightSidebar } from './ui/RightSidebar';
import { ActiveCardModal } from './ui/ActiveCardModal';
import { DarkCurseModal } from './ui/DarkCurseModal';
import { BankruptcyDraftModal } from './ui/BankruptcyDraftModal';
import { DefeatHowlerModal } from './ui/DefeatHowlerModal';
import { Lobby, GameSetupConfig } from './ui/Lobby';
import { soundManager } from './audio/soundManager';
import {
  generateMatchCode,
  broadcastSpectatorState,
  getLatestSpectatorState,
  subscribeToSpectatorState,
  getSpectatorUrl,
} from './core/spectatorSync';
import './App.css';
import { g, galleons } from './hpvn/money';
import { clearSave, loadSave, resumeState, writeSave, SavedGame, SAVE_TTL_MS } from './hpvn/saveGame';

const watchCodeFromUrl = (() => {
  if (typeof window === 'undefined') return '';
  const code = (new URLSearchParams(window.location.search).get('watch') || new URLSearchParams(window.location.search).get('spectate'))?.trim().toUpperCase() ?? '';
  return /^[A-Z0-9]{6}$/.test(code) ? code : '';
})();

export function App() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [inLobby, setInLobby] = useState<boolean>(!watchCodeFromUrl);
  const [myPlayerId, setMyPlayerId] = useState<string | undefined>(undefined);
  const [showDefeatModal, setShowDefeatModal] = useState<boolean>(false);
  const [activeDefeatDetails, setActiveDefeatDetails] = useState<BankruptcyDetails | null>(null);
  const [isSpectating, setIsSpectating] = useState<boolean>(() => !!watchCodeFromUrl);
  const [matchCode, setMatchCode] = useState<string>(() => watchCodeFromUrl || generateMatchCode());
  // HPVN online room (server seats and phase); null = local game
  const [room, setRoom] = useState<RoomView | null>(null);
  const [notice, setNotice] = useState<string>('');
  // A local game parked by a reload or "Thoát" (fresh for 30 minutes), offered back in the lobby.
  const [saved, setSaved] = useState<SavedGame | null>(() => loadSave());
  const roomRef = useRef<RoomView | null>(null);
  roomRef.current = room;

  const isSpectator = Boolean(
    isSpectating ||
    (gameState && myPlayerId && !gameState.players.some((p) => p.id === myPlayerId))
  );

  const isHostRef = useRef<boolean>(true);
  const online = room !== null;
  const isHost = !isSpectator && (!room || room.hostUid === identity?.uid);
  isHostRef.current = isHost;

  // The host's runtime (clock ticks, bots, its own reducer): applies directly.
  const dispatch = useCallback((action: GameAction) => {
    if (!isHostRef.current) return;
    setGameState((prev) => (prev ? gameReducer(prev, action) : null));
  }, []);

  // A seat acting online goes through authorizeAction with its own uid; a guest's goes to the host.
  const lastLiveRef = useRef(0);
  const applyAs = useCallback((playerId: string, action: unknown) => {
    setGameState((prev) => {
      const allowed = prev ? authorizeAction(prev, action, playerId) : null;
      return allowed ? gameReducer(prev!, allowed) : prev;
    });
  }, []);
  // The player's last own action: 30 minutes without one ends a local game (open or parked).
  const lastActionRef = useRef(Date.now());
  const uiDispatch = useCallback((action: GameAction) => {
    lastActionRef.current = Date.now();
    if (!roomRef.current || !identity) dispatch(action);
    else if (isHostRef.current) applyAs(identity.uid, action);
    else post('sb-input', { a: JSON.stringify({ action, v: lastLiveRef.current }), n: stamp() });
  }, [dispatch, applyAs]);

  // Room events from the HPVN parent: room changes for all, snapshots for guests, actions for the host.
  const baseVersionRef = useRef(0);
  const seenRef = useRef<Record<string, number>>({});
  useEffect(() => onRoomEvent((event) => {
    if (event.t === 'room') {
      const next = event.room;
      if (!next || next.phase === 'closed' || !identity || !next.memberUids.includes(identity.uid)) {
        if (roomRef.current) { setRoom(null); setGameState(null); setInLobby(true); setNotice('Phòng đã đóng.'); }
        return;
      }
      const prev = roomRef.current;
      setRoom(next);
      if (next.phase === 'lobby' && prev?.phase === 'playing') { setGameState(null); setInLobby(true); }
      return;
    }
    const current = roomRef.current;
    if (!current || current.phase !== 'playing') return;
    if (event.t === 'live' && current.hostUid !== identity?.uid && event.n > lastLiveRef.current) {
      const state = unpackSnapshot(event.s, current.epoch);
      if (!state) return;
      lastLiveRef.current = event.n;
      setGameState(state);
      const myUid = identity?.uid;
      setMyPlayerId(myUid);
      if (myUid && !state.players.some((p) => p.id === myUid)) {
        setIsSpectating(true);
      }
      setInLobby(false);
    } else if (event.t === 'inputs' && current.hostUid === identity?.uid) {
      for (const input of event.list) {
        if (typeof input.n !== 'number' || typeof input.a !== 'string' || input.n <= (seenRef.current[input.uid] ?? 0)) continue;
        seenRef.current[input.uid] = input.n;
        try {
          const { action, v } = JSON.parse(input.a);
          // an action written before this host session (an old game, or before a reload) is not replayed
          if (typeof v === 'number' && v >= baseVersionRef.current) applyAs(input.uid, action);
        } catch { /* malformed */ }
      }
    }
  }), [applyAs]);

  // The host publishes every change (at most 4 a second) to the room ring for the guests.
  const slotRef = useRef(0);
  useEffect(() => {
    if (!room || room.phase !== 'playing' || !isHost || !gameState || inLobby) return;
    const timer = window.setTimeout(() => {
      const n = stamp();
      if (!baseVersionRef.current) baseVersionRef.current = n;
      post('sb-live', { slot: slotRef.current++ % 6, n, s: packSnapshot(room.epoch, gameState) });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [gameState, room, isHost, inLobby]);

  // Broadcast current game state for live spectators (cross-tab & persistent cache)
  useEffect(() => {
    if (!gameState || inLobby || isSpectator) return;
    const code = room ? room.code : matchCode;
    const timer = window.setTimeout(() => {
      broadcastSpectatorState(code, gameState, room?.epoch ?? 1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [gameState, room, matchCode, inLobby, isSpectator]);

  // Subscribe to live spectator updates if in spectator mode
  useEffect(() => {
    if (!isSpectating) return;
    const code = room ? room.code : matchCode;
    if (!code) return;

    // Check cached state immediately
    const cached = getLatestSpectatorState(code, room?.epoch ?? 1);
    if (cached && !gameState) {
      setGameState(cached);
      setInLobby(false);
    }

    const unsubscribe = subscribeToSpectatorState(
      code,
      (incoming) => {
        setGameState(incoming);
        setInLobby(false);
      },
      room?.epoch ?? 1
    );

    return () => unsubscribe();
  }, [isSpectating, room?.code, matchCode, room?.epoch]);

  // Auto-connect to match if ?watch=CODE was in the URL on startup
  useEffect(() => {
    if (!watchCodeFromUrl) return;
    setIsSpectating(true);
    setMatchCode(watchCodeFromUrl);
    if (identity) {
      void roomAction(() => roomOp('join', { code: watchCodeFromUrl }));
    }
    const cached = getLatestSpectatorState(watchCodeFromUrl);
    if (cached) {
      setGameState(cached);
      setInLobby(false);
    }
  }, []);

  // A reload finds its table again: a guest waits for the next snapshot, the host picks the game up
  // from the newest one it published (or sends the room back to the lobby).
  useEffect(() => {
    if (!identity) return;
    void roomOp('locate').then(async (found) => {
      if (!found || found.phase === 'closed') return;
      setRoom(found);
      if (found.phase !== 'playing' || found.hostUid !== identity!.uid) return;
      const latest = await request<{ n: number; s: string } | null>('sb-restore');
      const state = latest && unpackSnapshot(latest.s, found.epoch);
      if (!state) { setRoom(await roomOp('lobby', { code: found.code })); return; }
      baseVersionRef.current = latest!.n;
      setGameState(state); setMyPlayerId(identity!.uid); setInLobby(false);
    }).catch(() => { /* offline: the lobby still works locally */ });
  }, []);

  const roomAction = async (run: () => Promise<RoomView | null>) => {
    setNotice('');
    try {
      const next = await run();
      const seated = next && next.phase !== 'closed' && identity && next.memberUids.includes(identity.uid) ? next : null;
      setRoom(seated);
      if (!seated || seated.phase === 'lobby') { setGameState(null); setInLobby(true); }
      return seated;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Không kết nối được phòng.');
      return null;
    }
  };

  const resetDefeatState = useCallback(() => {
    setShowDefeatModal(false);
    setActiveDefeatDetails(null);
    setIsSpectating(false);
  }, []);

  const startOnlineGame = async (bots: number, boardSize: number = 40) => {
    const current = roomRef.current;
    if (!current || !identity) return;
    const started = await roomAction(() => roomOp('start', { code: current.code, level: 0 }));
    if (!started?.playerUids) return;
    baseVersionRef.current = 0; seenRef.current = {};
    resetDefeatState();
    setGameState(seatPlayers(started.members, started.playerUids, bots, boardSize));
    setMyPlayerId(identity.uid); setInLobby(false);
  };

  // 1. Handle Start Game from Lobby
  const handleStartGame = async (config: GameSetupConfig) => {
    resetDefeatState();
    if (config.mode === 'SOLO') {
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

      const initial = createInitialState(players, config.boardSize || 40);
      setGameState(initial);
      setMyPlayerId(initial.players[0].id);
      setInLobby(false);
    } else if (config.mode === 'ONLINE_HOST') {
      await roomAction(() => roomOp('create', config.stake ? { stake: true } : {}));
    } else if (config.mode === 'ONLINE_JOIN') {
      await roomAction(() => roomOp('join', { code: config.roomCode }));
    } else if (config.mode === 'SPECTATE') {
      resetDefeatState();
      const code = config.roomCode.trim().toUpperCase();
      setMatchCode(code);
      setIsSpectating(true);
      if (identity) {
        await roomAction(() => roomOp('join', { code }));
      }
      const cached = getLatestSpectatorState(code);
      if (cached) {
        setGameState(cached);
      }
      setInLobby(false);
    } else if (config.mode === 'HOTSEAT') {
      const initial = createInitialState(config.players, config.boardSize || 40);
      setGameState(initial);
      setMyPlayerId(undefined); // Hotseat controls all
      setInLobby(false);
    }
  };

  const resumeSaved = () => {
    if (!saved) return;
    resetDefeatState();
    lastActionRef.current = Date.now();
    setGameState(resumeState(saved));
    setMyPlayerId(saved.myPlayerId);
    setInLobby(false);
    setSaved(null);
  };
  const discardSaved = () => { clearSave(); setSaved(null); };

  // Local games save themselves at most every 1.5 s (the clock changes the state every second, so this
  // is a throttle, not a debounce); a finished game leaves nothing behind.
  const latestSaveRef = useRef<{ state: GameState; me?: string } | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const cancelPendingSave = () => {
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;
    latestSaveRef.current = null;
  };
  useEffect(() => {
    if (room || inLobby || !gameState || isSpectator) return;
    if (gameState.turnPhase === 'GAME_OVER') { cancelPendingSave(); clearSave(); return; }
    latestSaveRef.current = { state: gameState, me: myPlayerId };
    if (saveTimerRef.current !== null) return;
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      const latest = latestSaveRef.current;
      if (latest) writeSave(latest.state, lastActionRef.current, latest.me);
    }, 1500);
  }, [gameState, room, inLobby, myPlayerId, isSpectator]);

  // Idle timeout: an open local table with no action from the player for 30 minutes closes itself;
  // a parked one simply expires (loadSave / the lobby card below).
  useEffect(() => {
    if (room || inLobby || !gameState || isSpectator) return;
    const check = window.setInterval(() => {
      if (Date.now() - lastActionRef.current < SAVE_TTL_MS) return;
      cancelPendingSave(); clearSave(); setSaved(null); setGameState(null); setInLobby(true);
      setNotice('Ván đã tự đóng vì 30 phút không có thao tác.');
    }, 15000);
    return () => window.clearInterval(check);
  }, [room, inLobby, !gameState, isSpectator]);
  useEffect(() => {
    if (!saved) return;
    const left = saved.lastActionAt + SAVE_TTL_MS - Date.now();
    const timer = window.setTimeout(() => { clearSave(); setSaved(null); setNotice('Ván đang dở đã hết hạn sau 30 phút không có thao tác.'); }, Math.max(0, left));
    return () => window.clearTimeout(timer);
  }, [saved]);

  /** "Thoát": a local game is parked (resumable for 30 minutes); an online seat leaves the room. */
  const exitGame = async () => {
    cancelPendingSave();
    resetDefeatState();
    if (room) { await roomAction(() => roomOp('leave', { code: room.code })); return; }
    if (gameState && gameState.turnPhase !== 'GAME_OVER' && !isSpectator) {
      writeSave(gameState, lastActionRef.current, myPlayerId);
      setSaved({ v: 1, savedAt: Date.now(), lastActionAt: lastActionRef.current, myPlayerId, state: gameState });
    }
    setGameState(null);
    setIsSpectating(false);
    setInLobby(true);
  };

  // Watch for local player bankruptcy to trigger Defeat Howler Modal
  useEffect(() => {
    if (!gameState || inLobby) return;
    if (isSpectator && !myPlayerId) return; // Outside spectator never gets defeat howler
    const localP = myPlayerId
      ? gameState.players.find((p) => p.id === myPlayerId)
      : !isSpectator ? gameState.players.find((p) => !p.isAI) : null;

    if (localP && localP.isBankrupt && localP.bankruptcyDetails) {
      if (!activeDefeatDetails || activeDefeatDetails.timestamp !== localP.bankruptcyDetails.timestamp) {
        setActiveDefeatDetails(localP.bankruptcyDetails);
        setShowDefeatModal(true);
      }
    }
  }, [gameState, myPlayerId, inLobby, activeDefeatDetails, isSpectator]);

  // Staked room: the host reports the winner once; the server settles the pot and writes stakeResult
  // on the room, which every seat (and the HPVN result banner) then reads.
  const reportedRef = useRef('');
  useEffect(() => {
    if (!room?.stake || !isHost || room.phase !== 'playing' || !gameState || gameState.turnPhase !== 'GAME_OVER' || !gameState.winner) return;
    const key = `${room.code}:${room.epoch}`;
    if (reportedRef.current === key || room.stakeResult?.epoch === room.epoch) return;
    reportedRef.current = key;
    roomOp('result', { code: room.code, winner: gameState.winner.id })
      .then((next) => { if (next && next.phase !== 'closed') setRoom(next); })
      .catch((error) => setNotice(error instanceof Error ? error.message : 'Chưa chốt được tiền cược.'));
  }, [room, isHost, gameState?.turnPhase, gameState?.winner]);

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
    const isDraftBotTurn =
      !!gameState.bankruptcyDraft &&
      gameState.players.find(
        (p) => p.id === gameState.bankruptcyDraft?.draftOrder[gameState.bankruptcyDraft?.currentDraftIndex]
      )?.isAI;
    const isBankruptcyBotTurn =
      gameState.turnPhase === 'BANKRUPTCY' &&
      gameState.bankruptcyInfo &&
      gameState.players.find((p) => p.id === gameState.bankruptcyInfo?.debtorId)?.isAI;

    if (isBotTurn || isAuctionBotBid || isDraftBotTurn || isBankruptcyBotTurn) {
      const activeBot = isDraftBotTurn
        ? gameState.players.find(
            (p) => p.id === gameState.bankruptcyDraft?.draftOrder[gameState.bankruptcyDraft?.currentDraftIndex]
          )
        : isBankruptcyBotTurn
        ? gameState.players.find((p) => p.id === gameState.bankruptcyInfo?.debtorId)
        : isAuctionBotBid
        ? gameState.players.find(
            (p) => p.id === gameState.auction?.activeBidders[gameState.auction?.currentBidderIndex || 0]
          )
        : currentPlayer;

      if (!activeBot) return;

      // Pause bot actions while magic card popup is being presented
      if (gameState.activeCard) return;

      // Bot thinking delay: longer when making important decisions (ACTION phase), shorter for quick actions
      const isTurbo = !!gameState.turboMode;
      const thinkingDelay = isTurbo
        ? (gameState.bankruptcyDraft ? 250 : gameState.turnPhase === 'BANKRUPTCY' ? 200 : gameState.turnPhase === 'ACTION' ? 350 : 120)
        : (gameState.bankruptcyDraft ? 550 : gameState.turnPhase === 'BANKRUPTCY' ? 450 : gameState.turnPhase === 'ACTION' ? 900 : 350);

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
    if (!gameState || gameState.turnPhase === 'GAME_OVER' || inLobby || isSpectator) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is currently typing in an input or textarea
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      // 'T' or 't' -> Toggle Turbo Speed Mode
      if (e.code === 'KeyT') {
        e.preventDefault();
        uiDispatch({ type: 'TOGGLE_TURBO' });
        return;
      }

      // If dark curse escalation modal is open -> Space/Enter/Escape dismisses it
      if (gameState.activeEscalationEvent) {
        if (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape') {
          e.preventDefault();
          uiDispatch({ type: 'DISMISS_ESCALATION' });
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
          uiDispatch({ type: 'ROLL_DICE' });
        } else if (gameState.turnPhase === 'END_TURN') {
          e.preventDefault();
          uiDispatch({ type: 'END_TURN' });
        } else if (gameState.turnPhase === 'ACTION' && (gameState.takeoverCandidate || gameState.upgradeCandidate)) {
          e.preventDefault();
          uiDispatch({ type: 'PASS_PROPERTY' });
        }
      }

      // 'B' or 'b' -> Quick Buy, Hostile Takeover, or Upgrade Owned Property
      if (e.code === 'KeyB' && gameState.turnPhase === 'ACTION') {
        const boardTiles = gameState.boardTiles || HOGWARTS_TILES;
        const tile = boardTiles[curP.position];
        if (gameState.upgradeCandidate && tile && tile.id === gameState.upgradeCandidate.propertyId) {
          if (curP.balance >= gameState.upgradeCandidate.cost) {
            e.preventDefault();
            if (gameState.upgradeCandidate.isHotelUpgrade) {
              uiDispatch({ type: 'BUILD_HOTEL', propertyId: tile.id, playerId: curP.id });
            } else {
              uiDispatch({ type: 'BUILD_HOUSE', propertyId: tile.id, playerId: curP.id });
            }
          }
        } else if (gameState.takeoverCandidate && tile && tile.id === gameState.takeoverCandidate.propertyId) {
          if (curP.balance >= gameState.takeoverCandidate.cost) {
            e.preventDefault();
            uiDispatch({ type: 'TAKEOVER_PROPERTY', propertyId: tile.id });
          }
        } else if (tile && tile.price && curP.balance >= tile.price && !gameState.propertyOwnership[tile.id]) {
          e.preventDefault();
          uiDispatch({ type: 'BUY_PROPERTY', propertyId: tile.id });
        }
      }

      // 'P' or 'p' -> Quick Pass (to Auction if unowned, or to END_TURN if takeover)
      if (e.code === 'KeyP' && gameState.turnPhase === 'ACTION') {
        e.preventDefault();
        uiDispatch({ type: 'PASS_PROPERTY' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, inLobby, myPlayerId, uiDispatch]);

  if (isSpectating && !gameState && !inLobby) {
    return (
      <div className="lobby-overlay">
        <div className="lobby-modal-card hpvn-lobby" style={{ textAlign: 'center', padding: '32px 24px' }}>
          <header className="hpvn-lobby-head">
            <p className="hpvn-eyebrow">Khán giả · Đang kết nối trực tiếp</p>
            <h1 className="lobby-title" style={{ fontSize: '1.45rem' }}>Phòng {room ? room.code : matchCode}</h1>
          </header>
          <div style={{ margin: '24px 0', fontSize: '2.5rem' }}>👁️</div>
          <p style={{ color: '#ecdcc9', fontSize: '0.95rem', marginBottom: '8px' }}>
            Đang đồng bộ dữ liệu thời gian thực từ bàn cờ…
          </p>
          <p className="hpvn-hint" style={{ marginBottom: '24px' }}>
            Bàn cờ 3D và trạng thái sẽ tự động xuất hiện ngay khi chủ phòng bắt đầu hoặc phát tín hiệu lượt chơi.
          </p>
          <button className="btn-launch-game" onClick={exitGame} style={{ maxWidth: '240px', margin: '0 auto' }}>
            Quay lại Sảnh
          </button>
        </div>
      </div>
    );
  }

  if (room && (inLobby || !gameState)) {
    return (
      <OnlineLobby
        room={room}
        notice={notice}
        waiting={room.phase === 'playing'}
        onStart={startOnlineGame}
        onLeave={() => roomAction(() => roomOp('leave', { code: room.code }))}
      />
    );
  }
  if (inLobby || !gameState) {
    return <Lobby onStartGame={(config) => { if (config.mode === 'SOLO' || config.mode === 'HOTSEAT') discardSaved(); return handleStartGame(config); }} notice={notice}
      saved={saved} onResume={resumeSaved} onDiscard={discardSaved} />;
  }

  const isGameOver = gameState.turnPhase === 'GAME_OVER';

  return (
    <div className="main-game-layout">
      {/* Left Stage: 3D Three.js Board (70-75% screen width) */}
      <main className="board-3d-stage">
        <BoardThreeJS gameState={gameState} myPlayerId={myPlayerId} />
      </main>

      {/* Right Stage: Fixed Control Sidebar (25-30% screen width) */}
      <RightSidebar
        gameState={gameState}
        dispatch={uiDispatch}
        roomCode={room ? room.code : matchCode}
        myPlayerId={myPlayerId}
        isHost={isHost}
        isSpectator={isSpectator}
        onExit={exitGame}
        stakeAtRisk={room?.stake && room.phase === 'playing' && room.stakeResult?.epoch !== room.epoch ? room.stake : 0}
      />

      {/* Magic Active Card 3D Flip Modal */}
      {gameState.activeCard && (
        <ActiveCardModal
          card={gameState.activeCard}
          player={gameState.players[gameState.currentPlayerIndex]}
          isMyTurn={!isSpectator && (!myPlayerId || gameState.players[gameState.currentPlayerIndex]?.id === myPlayerId)}
          onDismiss={() => uiDispatch({ type: 'DISMISS_CARD' })}
          turboMode={gameState.turboMode}
        />
      )}

      {/* Dark Curse Storm (Voldemort's Escalation) Modal */}
      {gameState.activeEscalationEvent && (
        <DarkCurseModal
          event={gameState.activeEscalationEvent}
          onDismiss={() => uiDispatch({ type: 'DISMISS_ESCALATION' })}
        />
      )}

      {/* Bankruptcy Redistribution Draft Modal */}
      {gameState.bankruptcyDraft && (
        <BankruptcyDraftModal
          draft={gameState.bankruptcyDraft}
          players={gameState.players}
          myPlayerId={myPlayerId}
          boardTiles={gameState.boardTiles}
          isSpectator={isSpectator}
          onSelectProperty={(propertyId) => uiDispatch({ type: 'SELECT_DRAFT_PROPERTY', propertyId })}
        />
      )}

      {/* Spectator Mode Sticky Ribbon */}
      {isSpectator && !isGameOver && (
        <div className="spectator-badge-ribbon">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="live-dot" />
            <span>
              👁️ {activeDefeatDetails ? 'Bạn đang là Khán Giả (Đã phá sản)' : `Khán Giả · Đang xem ván ${room ? room.code : matchCode}`}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {activeDefeatDetails && (
              <button
                className="btn-view-howler-small"
                onClick={() => setShowDefeatModal(true)}
              >
                Xem lại Thư Sấm
              </button>
            )}
            <button
              className="btn-view-howler-small"
              onClick={() => {
                const code = room ? room.code : matchCode;
                navigator.clipboard.writeText(getSpectatorUrl(code));
                setNotice('Đã chép link xem ván cho khán giả!');
                setTimeout(() => setNotice(''), 2500);
              }}
              title="Sao chép link mời bạn bè xem cùng"
            >
              🔗 Link xem
            </button>
            <button
              className="btn-view-howler-small"
              onClick={exitGame}
              title="Rời trận đấu về sảnh"
            >
              Về sảnh
            </button>
          </div>
        </div>
      )}

      {/* Howler Defeat Notification Modal */}
      {showDefeatModal && activeDefeatDetails && (
        <DefeatHowlerModal
          details={activeDefeatDetails}
          isGameOver={gameState.turnPhase === 'GAME_OVER'}
          onClose={() => {
            setShowDefeatModal(false);
            if (gameState.turnPhase !== 'GAME_OVER') {
              setIsSpectating(true);
            }
          }}
          onSpectate={() => {
            setShowDefeatModal(false);
            setIsSpectating(true);
          }}
          onLeave={exitGame}
          onRestart={!room ? () => { resetDefeatState(); setInLobby(true); } : undefined}
        />
      )}

      {/* Victory / Game Over Podium Modal */}
      {isGameOver && (
        <div className="game-over-overlay">
          <div className="victory-card">
                        <p className="hpvn-eyebrow">Kết thúc ván</p>
            <div className="winner-banner-name">{gameState.winner?.name || 'Người thắng'}</div>
            <div style={{ color: '#f3d189', fontSize: '1.2rem', fontWeight: 700 }}>
              {gameState.winner?.house} {gameState.winner?.tokenIcon}
            </div>

            {room?.stake ? (() => {
              const settled = room.stakeResult?.epoch === room.epoch ? room.stakeResult : null;
              const mine = identity?.uid;
              const text = !settled ? (notice || 'Đang chốt tiền cược…')
                : settled.refunded ? `Ván không có kết quả: đã hoàn ${galleons(settled.stake)} cho mọi người.`
                : settled.winnerUid === mine ? `Bạn nhận ${galleons(settled.pot ?? 0)}${settled.held ? ', chờ duyệt tối đa 24 giờ.' : ' vào Gringotts.'}`
                : `Bạn mất ${galleons(settled.stake)} tiền cược.`;
              return <p className={`hpvn-stake-outcome ${settled && settled.winnerUid === mine ? 'is-won' : ''}`}>{text}</p>;
            })() : null}

            <div className="winner-meta-stats">
              <div>
                <div style={{ fontSize: '0.75rem', color: '#bb9c7c' }}>Tổng tài sản</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f3d189' }}>
                  {g(gameState.winner?.netWorth)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#bb9c7c' }}>Tiền mặt</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f3d189' }}>
                  {g(gameState.winner?.balance)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#bb9c7c' }}>Số ô đất</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10b981' }}>
                  {gameState.winner?.properties.length} ô
                </div>
              </div>
            </div>

            {online && !isHost && !isSpectator ? (
              <div style={{ marginTop: '12px', color: '#bb9c7c' }}>Chờ chủ phòng mở ván mới…</div>
            ) : isSpectator ? (
              <button
                className="btn-launch-game"
                style={{ marginTop: '12px' }}
                onClick={exitGame}
              >
                Về sảnh chính
              </button>
            ) : (
              <button
                className="btn-launch-game"
                style={{ marginTop: '12px' }}
                onClick={() => (room ? roomAction(() => roomOp('lobby', { code: room.code })) : setInLobby(true))}
              >
                Chơi ván mới
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
