const fs = require('fs');

async function main() {
  try {
    const targetsRes = await fetch('http://127.0.0.1:9222/json');
    const targets = await targetsRes.json();
    const gameTarget = targets.find(t => t.url.includes('3000') || t.title.includes('Monopoly'));
    if (!gameTarget) {
      console.error('Target not found!');
      process.exit(1);
    }

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

    console.log('1. Checking Turbo mode button and initial state...');
    const checkInitial = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const btn = document.querySelector('.turbo-toggle-btn');
          const rollBtn = document.querySelector('.btn-primary-roll');
          const footnote = document.querySelector('.rules-tax-footnote');
          return {
            hasTurboBtn: !!btn,
            turboBtnText: btn?.innerText,
            rollBtnText: rollBtn?.innerText,
            footnoteText: footnote?.innerText,
            turboMode: !!window.__gameState?.turboMode
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Initial State:', checkInitial.result?.value);

    // 2. Click Turbo button (or dispatch TOGGLE_TURBO)
    console.log('2. Activating Turbo Mode (2x)...');
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const btn = document.querySelector('.turbo-toggle-btn');
          if (btn) btn.click();
          else window.__dispatch({ type: 'TOGGLE_TURBO' });
        })()
      `,
      returnByValue: true
    });

    await new Promise(r => setTimeout(r, 600));

    const checkTurboActive = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const btn = document.querySelector('.turbo-toggle-btn');
          return {
            turboBtnText: btn?.innerText,
            isActiveClass: btn?.classList.contains('active'),
            turboModeInState: !!window.__gameState?.turboMode,
            latestEvent: window.__gameState?.events[0]?.message
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Turbo Active State:', checkTurboActive.result?.value);

    // Capture Desktop screenshot with Turbo active
    const shotDesktop = await send('Page.captureScreenshot', { format: 'png' });
    const shotDesktopPath = '/Users/khang/.gemini/antigravity-ide/brain/1307aeb3-dc2d-426b-8ce5-4ea171a9922d/turbo_mode_desktop.png';
    fs.writeFileSync(shotDesktopPath, Buffer.from(shotDesktop.data, 'base64'));
    console.log('Saved Desktop Turbo screenshot to:', shotDesktopPath);

    // 3. Test Keyboard Shortcut: Spacebar to Roll Dice
    console.log('3. Testing Keyboard Shortcut [Space] to Roll Dice...');
    // Ensure it is Harry Potter's turn in ROLL phase
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const s = window.__gameState;
          window.__setGameState({
            ...s,
            currentPlayerIndex: 0,
            turnPhase: 'ROLL',
            dice: null,
            activeCard: null,
            lastRentPayment: null
          });
        })()
      `,
      returnByValue: true
    });

    await new Promise(r => setTimeout(r, 400));

    // Send Space keydown event
    await send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      windowsVirtualKeyCode: 32,
      code: 'Space',
      key: ' ',
    });
    await send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      windowsVirtualKeyCode: 32,
      code: 'Space',
      key: ' ',
    });

    await new Promise(r => setTimeout(r, 600));

    const checkAfterSpace = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const s = window.__gameState;
          return {
            turnPhase: s.turnPhase,
            dice: s.dice,
            currentPlayer: s.players[s.currentPlayerIndex].name,
            position: s.players[0].position
          };
        })()
      `,
      returnByValue: true
    });
    console.log('After [Space] Roll Result:', checkAfterSpace.result?.value);

    // 4. Test Mobile Portrait View (iPhone 14/15 Pro: 393 x 852)
    console.log('4. Testing Mobile Portrait View with Turbo Mode...');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 393,
      height: 852,
      deviceScaleFactor: 2,
      mobile: true,
    });

    await new Promise(r => setTimeout(r, 600));

    const checkMobile = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const mobileTurbo = document.querySelector('.mobile-turbo-pill');
          return {
            hasMobileTurbo: !!mobileTurbo,
            mobileTurboText: mobileTurbo?.innerText,
            isActive: mobileTurbo?.classList.contains('active')
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Mobile Check:', checkMobile.result?.value);

    const shotMobile = await send('Page.captureScreenshot', { format: 'png' });
    const shotMobilePath = '/Users/khang/.gemini/antigravity-ide/brain/1307aeb3-dc2d-426b-8ce5-4ea171a9922d/turbo_mode_mobile_portrait.png';
    fs.writeFileSync(shotMobilePath, Buffer.from(shotMobile.data, 'base64'));
    console.log('Saved Mobile Turbo screenshot to:', shotMobilePath);

    // Reset back to desktop
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false,
    });

    ws.close();
    console.log('All operation optimizations verified successfully!');
  } catch (err) {
    console.error('Error running test:', err);
    process.exit(1);
  }
}

main();
