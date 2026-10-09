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

    // 1. Check Initial State for Escalation Fields
    console.log('1. Checking initial escalation properties in gameState...');
    const checkInit = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const s = window.__gameState;
          return {
            rentMultiplier: s.rentMultiplier,
            nextEscalationRound: s.nextEscalationRound,
            maxRentMultiplier: s.maxRentMultiplier,
            turnNumber: s.turnNumber
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Initial Escalation Config:', checkInit.result?.value);

    // 2. Trigger Escalation Event (simulating reaching the randomized round X)
    console.log('2. Simulating reaching randomized Escalation Round...');
    const triggerEscalation = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const s = window.__gameState;
          const targetRound = s.nextEscalationRound || 5;

          // Set state to round right before targetRound, last player ending turn
          const preState = {
            ...s,
            turnNumber: targetRound - 1,
            currentPlayerIndex: s.players.length - 1,
            turnPhase: 'END_TURN',
            consecutiveDoubles: 0,
            activeCard: null,
            lastRentPayment: null
          };

          // Advance turn so nextTurnNumber = targetRound and nextIndex = 0
          const escalated = window.__gameReducer(preState, { type: 'END_TURN' });
          window.__setGameState(escalated);

          return {
            prevRound: preState.turnNumber,
            newRound: escalated.turnNumber,
            rentMultiplier: escalated.rentMultiplier,
            hasActiveEscalationEvent: !!escalated.activeEscalationEvent,
            escalationMessage: escalated.activeEscalationEvent?.message
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Triggered Escalation State:', JSON.stringify(triggerEscalation.result?.value, null, 2));

    await new Promise(r => setTimeout(r, 600));

    // 3. Verify DOM for DarkCurseModal and header pill
    console.log('3. Verifying DarkCurseModal and Header Pill in DOM...');
    const checkDomModal = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const modal = document.querySelector('.dark-curse-modal');
          const title = document.querySelector('.dark-curse-title');
          const multBanner = document.querySelector('.dark-curse-multiplier-banner');
          const cursePill = document.querySelector('.curse-multiplier-pill');

          return {
            hasModal: !!modal,
            titleText: title?.innerText,
            bannerText: multBanner?.innerText?.replace(/\\s+/g, ' ').trim(),
            hasCursePill: !!cursePill,
            pillText: cursePill?.innerText?.replace(/\\s+/g, ' ').trim()
          };
        })()
      `,
      returnByValue: true
    });
    console.log('DOM Check during DarkCurseModal:', JSON.stringify(checkDomModal.result?.value, null, 2));

    // Capture screenshot of DarkCurseModal
    const shotModal = await send('Page.captureScreenshot', { format: 'png' });
    const shotModalPath = '/Users/khang/.gemini/antigravity-ide/brain/1307aeb3-dc2d-426b-8ce5-4ea171a9922d/dark_curse_modal_escalation.png';
    fs.writeFileSync(shotModalPath, Buffer.from(shotModal.data, 'base64'));
    console.log('Saved DarkCurseModal screenshot to:', shotModalPath);

    // 4. Dismiss Modal (click button or dispatch DISMISS_ESCALATION)
    console.log('4. Dismissing DarkCurseModal...');
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const acceptBtn = document.querySelector('.btn-dark-curse-accept');
          if (acceptBtn) acceptBtn.click();
          else window.__dispatch({ type: 'DISMISS_ESCALATION' });
        })()
      `,
      returnByValue: true
    });

    await new Promise(r => setTimeout(r, 600));

    // 5. Verify board after dismissal with active x2 pill in sidebar
    console.log('5. Verifying Board & Sidebar with Active X2 Curse Status...');
    const checkAfterDismiss = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const cursePill = document.querySelector('.curse-multiplier-pill');
          return {
            modalClosed: !document.querySelector('.dark-curse-modal'),
            hasCursePill: !!cursePill,
            pillText: cursePill?.innerText?.replace(/\\s+/g, ' ').trim()
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Board State after Dismiss:', checkAfterDismiss.result?.value);

    // Capture screenshot of Board with X2 Curse Active
    const shotBoard = await send('Page.captureScreenshot', { format: 'png' });
    const shotBoardPath = '/Users/khang/.gemini/antigravity-ide/brain/1307aeb3-dc2d-426b-8ce5-4ea171a9922d/dark_curse_active_board.png';
    fs.writeFileSync(shotBoardPath, Buffer.from(shotBoard.data, 'base64'));
    console.log('Saved Board with X2 Curse Active screenshot to:', shotBoardPath);

    // 6. Test Mobile Portrait View (iPhone 14/15 Pro: 393 x 852)
    console.log('6. Testing Mobile Portrait View with X2 Curse Pill...');
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
          const mobileCurse = document.querySelector('.mobile-curse-pill');
          return {
            hasMobileCurse: !!mobileCurse,
            text: mobileCurse?.innerText?.replace(/\\s+/g, ' ').trim()
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Mobile Check:', checkMobile.result?.value);

    const shotMobile = await send('Page.captureScreenshot', { format: 'png' });
    const shotMobilePath = '/Users/khang/.gemini/antigravity-ide/brain/1307aeb3-dc2d-426b-8ce5-4ea171a9922d/dark_curse_mobile_portrait.png';
    fs.writeFileSync(shotMobilePath, Buffer.from(shotMobile.data, 'base64'));
    console.log('Saved Mobile Curse screenshot to:', shotMobilePath);

    // Reset back to desktop
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false,
    });

    ws.close();
    console.log('All Dark Curse Escalation verification steps completed successfully!');
  } catch (err) {
    console.error('Error running test:', err);
    process.exit(1);
  }
}

main();
