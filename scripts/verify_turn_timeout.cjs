const fs = require('fs');

async function main() {
  try {
    const targetsRes = await fetch('http://127.0.0.1:9222/json');
    const targets = await targetsRes.json();
    const gameTarget = targets.find(t => t.url.includes('3000') || t.title.includes('Monopoly'));
    if (!gameTarget) {
      console.error('Monopoly target not found! Targets:', targets);
      process.exit(1);
    }

    console.log('Connecting to target:', gameTarget.title);

    const ws = new globalThis.WebSocket(gameTarget.webSocketDebuggerUrl);
    let id = 1;
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const msgId = id++;
      const handler = (evt) => {
        const msg = JSON.parse(evt.data);
        if (msg.id === msgId) {
          ws.removeEventListener('message', handler);
          if (msg.error) reject(msg.error);
          else resolve(msg.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });

    await new Promise(r => ws.addEventListener('open', r));

    // Desktop Viewport
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false,
    });

    // 0. Ensure game is launched from Lobby
    const launchCheck = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const launchBtn = document.querySelector('.btn-launch-game');
          if (launchBtn) {
            launchBtn.click();
            return { launched: true };
          }
          return { alreadyInGame: !!window.__gameState };
        })()
      `,
      returnByValue: true
    });
    console.log('Game Launch status:', launchCheck.result?.value);

    await new Promise(r => setTimeout(r, 1200));

    // 1. Setup a controlled state:
    // Human player (Harry Potter, p-0) on their turn, with turn timer at 8 seconds (close to expiring)
    console.log('1. Setting up state with turn timer at 8s (warning state)...');
    const setupWarning = await send('Runtime.evaluate', {
      expression: `
        (() => {
          let s = window.__gameState;
          if (!s || !window.__setGameState) return { error: 'No gameState available' };

          const testState = {
            ...s,
            currentPlayerIndex: 0, // Harry Potter
            turnPhase: 'ROLL',
            turnSecondsRemaining: 8,
            maxTurnSeconds: 60,
            activeCard: null,
            lastRentPayment: null
          };

          window.__setGameState(testState);
          return {
            turnSecondsRemaining: testState.turnSecondsRemaining,
            currentPlayer: testState.players[0].name,
            turnPhase: testState.turnPhase
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Setup Warning State:', setupWarning.result?.value);

    await new Promise(r => setTimeout(r, 600));

    // Verify DOM displays turn timer pill, warning class, and progress bar
    const checkDomWarning = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const turnPill = document.querySelector('.turn-timer-pill');
          const turnNum = document.querySelector('.turn-timer-num');
          const progressBar = document.querySelector('.turn-timer-fill');
          
          return {
            hasTurnPill: !!turnPill,
            pillClasses: turnPill ? turnPill.className : null,
            pillText: turnPill ? turnPill.innerText.replace(/\\s+/g, ' ').trim() : null,
            turnNumText: turnNum ? turnNum.innerText : null,
            hasProgressBar: !!progressBar,
            barWidth: progressBar ? progressBar.style.width : null
          };
        })()
      `,
      returnByValue: true
    });
    console.log('DOM Warning Check:', JSON.stringify(checkDomWarning.result?.value, null, 2));

    // Screenshot of 8s warning state on Desktop
    const shotWarning = await send('Page.captureScreenshot', { format: 'png' });
    const shotWarningPath = '/Users/khang/.gemini/antigravity-ide/brain/1307aeb3-dc2d-426b-8ce5-4ea171a9922d/turn_timer_warning_8s.png';
    fs.writeFileSync(shotWarningPath, Buffer.from(shotWarning.data, 'base64'));
    console.log('Saved screenshot of warning state to:', shotWarningPath);

    // 2. Test Timeout Auto-Resolution:
    // Dispatch TURN_TIMEOUT when timer hits 0
    console.log('2. Triggering TURN_TIMEOUT to verify auto-processing...');
    const triggerTimeout = await send('Runtime.evaluate', {
      expression: `
        (() => {
          let s = window.__gameState;
          const prevName = s.players[s.currentPlayerIndex].name;
          
          // Dispatch TURN_TIMEOUT action through central dispatcher
          window.__dispatch({ type: 'TURN_TIMEOUT' });
          
          let nextState = window.__gameState;
          return {
            prevPlayer: prevName,
            nextPlayer: nextState.players[nextState.currentPlayerIndex].name,
            nextTurnPhase: nextState.turnPhase,
            nextTurnSecondsRemaining: nextState.turnSecondsRemaining,
            latestEvent: nextState.events[0]?.message
          };
        })()
      `,
      returnByValue: true
    });
    console.log('After TURN_TIMEOUT State:', triggerTimeout.result?.value);

    await new Promise(r => setTimeout(r, 600));

    // Capture screenshot after auto-handling
    const shotAuto = await send('Page.captureScreenshot', { format: 'png' });
    const shotAutoPath = '/Users/khang/.gemini/antigravity-ide/brain/1307aeb3-dc2d-426b-8ce5-4ea171a9922d/after_turn_timeout_handled.png';
    fs.writeFileSync(shotAutoPath, Buffer.from(shotAuto.data, 'base64'));
    console.log('Saved screenshot after timeout auto-handling to:', shotAutoPath);

    // 3. Test Mobile Portrait View (iPhone 14/15 Pro: 393 x 852)
    console.log('3. Testing Mobile Portrait View with Turn Countdown Timer...');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 393,
      height: 852,
      deviceScaleFactor: 2,
      mobile: true,
    });

    // Set mobile state with 42s remaining for active player
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          let s = window.__gameState;
          window.__setGameState({
            ...s,
            currentPlayerIndex: 0,
            turnPhase: 'ROLL',
            turnSecondsRemaining: 42,
            activeCard: null
          });
        })()
      `,
      returnByValue: true
    });

    await new Promise(r => setTimeout(r, 600));

    const checkMobileDom = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const mobileTimer = document.querySelector('.mobile-turn-countdown');
          return {
            hasMobileTimer: !!mobileTimer,
            mobileTimerText: mobileTimer ? mobileTimer.innerText.replace(/\\s+/g, ' ').trim() : null,
            classes: mobileTimer ? mobileTimer.className : null
          };
        })()
      `,
      returnByValue: true
    });
    console.log('DOM Mobile Check:', JSON.stringify(checkMobileDom.result?.value, null, 2));

    const shotMobile = await send('Page.captureScreenshot', { format: 'png' });
    const shotMobilePath = '/Users/khang/.gemini/antigravity-ide/brain/1307aeb3-dc2d-426b-8ce5-4ea171a9922d/turn_timer_mobile_portrait.png';
    fs.writeFileSync(shotMobilePath, Buffer.from(shotMobile.data, 'base64'));
    console.log('Saved screenshot of mobile portrait with timer to:', shotMobilePath);

    // Reset back to desktop
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false,
    });

    ws.close();
    console.log('All turn timer verification steps completed successfully!');
  } catch (err) {
    console.error('Error running test:', err);
    process.exit(1);
  }
}

main();
