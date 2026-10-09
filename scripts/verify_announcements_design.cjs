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

    // 0. Ensure game is launched from Lobby and dismiss any pending cards
    const launchCheck = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const launchBtn = document.querySelector('.btn-launch-game');
          if (launchBtn) {
            launchBtn.click();
            return { launched: true };
          }
          if (window.__dispatch) {
            window.__dispatch({ type: 'DISMISS_CARD' });
            window.__dispatch({ type: 'DISMISS_ESCALATION' });
          }
          return { alreadyInGame: !!window.__gameState };
        })()
      `,
      returnByValue: true
    });
    console.log('Game Launch status:', launchCheck.result?.value);
    await new Promise(r => setTimeout(r, 1200));

    // 1. Trigger Purchase Announcement (Property Claimed)
    console.log('1. Triggering Purchase Notice with miniature card thumbnail...');
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          if (!window.__gameState || !window.__dispatch) return false;
          // Buy property tile 1 (Hẻm Xéo / Diagon Alley) for player 0
          window.__dispatch({ type: 'BUY_PROPERTY', propertyId: 'tile-1' });
          return true;
        })()
      `
    });
    await new Promise(r => setTimeout(r, 600));

    const shot1 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('/Users/khang/monopoly/purchase_announcement_desktop.png', Buffer.from(shot1.data, 'base64'));
    console.log('Saved: purchase_announcement_desktop.png');

    // 2. Trigger Rent Paid Announcement
    console.log('2. Triggering Rent Paid Notice...');
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          if (!window.__gameState || !window.__dispatch) return false;
          // Trigger a rent payment to show rentNotice
          const p0 = window.__gameState.players[0];
          const p1 = window.__gameState.players[1];
          const tile = window.__gameState.board?.tiles?.[1] || { id: 'tile-1', name: 'Hẻm Xéo', index: 1, baseRent: 10 };
          
          // Dispatch fake rent payment in state or trigger via event
          // Let's set lastRentPayment directly in gameState if possible or via action
          window.__gameState.lastRentPayment = {
            debtorId: p1.id,
            creditorId: p0.id,
            amount: 50,
            tileId: 'tile-1',
            isTax: false,
            timestamp: Date.now()
          };
          // Force re-render
          window.__dispatch({ type: 'TOGGLE_TURBO' });
          window.__dispatch({ type: 'TOGGLE_TURBO' });
          return true;
        })()
      `
    });
    await new Promise(r => setTimeout(r, 600));

    const shot2 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('/Users/khang/monopoly/rent_announcement_desktop.png', Buffer.from(shot2.data, 'base64'));
    console.log('Saved: rent_announcement_desktop.png');

    // 3. Trigger Tax Deduction Announcement
    console.log('3. Triggering Tax Deduction Notice...');
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          if (!window.__gameState || !window.__dispatch) return false;
          const p1 = window.__gameState.players[1];
          window.__gameState.lastRentPayment = {
            debtorId: p1.id,
            creditorId: null,
            amount: 100,
            tileId: 'tile-4', // Thuế Thu Nhập Phù Thủy
            isTax: true,
            timestamp: Date.now() + 1
          };
          window.__dispatch({ type: 'TOGGLE_TURBO' });
          window.__dispatch({ type: 'TOGGLE_TURBO' });
          return true;
        })()
      `
    });
    await new Promise(r => setTimeout(r, 600));

    const shot3 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('/Users/khang/monopoly/tax_announcement_desktop.png', Buffer.from(shot3.data, 'base64'));
    console.log('Saved: tax_announcement_desktop.png');

    // 4. Trigger Landed Property Decision Box in RightSidebar
    console.log('4. Setting turnPhase to ACTION on unowned property to view sidebar decision card...');
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          if (!window.__gameState || !window.__dispatch) return false;
          const p0 = window.__gameState.players[0];
          p0.position = 3; // Tiệm Đũa Phép Ollivanders
          window.__gameState.currentPlayerIndex = 0;
          window.__gameState.turnPhase = 'ACTION';
          window.__dispatch({ type: 'TOGGLE_TURBO' });
          window.__dispatch({ type: 'TOGGLE_TURBO' });
          return true;
        })()
      `
    });
    await new Promise(r => setTimeout(r, 600));

    const shot4 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('/Users/khang/monopoly/landed_decision_desktop.png', Buffer.from(shot4.data, 'base64'));
    console.log('Saved: landed_decision_desktop.png');

    // 5. Trigger Dark Curse Escalation Modal
    console.log('5. Triggering Dark Curse Escalation Modal...');
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          if (!window.__gameState || !window.__dispatch) return false;
          window.__gameState.activeEscalationEvent = {
            round: 5,
            multiplier: 2,
            title: 'BÃO LỜI NGUYỄN HẮC ÁM',
            description: 'Voldemort và Tử Thần Thực Tử đã phủ bóng đen lên toàn cõi Hogwarts! Toàn bộ thuế & tiền thuê đất từ nay X2 VĨNH VIỄN!'
          };
          window.__gameState.rentMultiplier = 2;
          window.__dispatch({ type: 'TOGGLE_TURBO' });
          window.__dispatch({ type: 'TOGGLE_TURBO' });
          return true;
        })()
      `
    });
    await new Promise(r => setTimeout(r, 700));

    const shot5 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('/Users/khang/monopoly/dark_curse_modal_desktop.png', Buffer.from(shot5.data, 'base64'));
    console.log('Saved: dark_curse_modal_desktop.png');

    // Dismiss modal for mobile check
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          if (window.__dispatch) {
            window.__dispatch({ type: 'DISMISS_ESCALATION' });
          }
        })()
      `
    });
    await new Promise(r => setTimeout(r, 400));

    // 6. Mobile Portrait Viewport Check (390 x 844 iPhone 14)
    console.log('6. Testing Mobile Portrait Viewport (390x844)...');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await new Promise(r => setTimeout(r, 500));

    // Trigger purchase announcement on mobile
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          if (!window.__gameState || !window.__dispatch) return false;
          window.__dispatch({ type: 'BUY_PROPERTY', propertyId: 'tile-3' });
          return true;
        })()
      `
    });
    await new Promise(r => setTimeout(r, 600));

    const shot6 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('/Users/khang/monopoly/purchase_announcement_mobile.png', Buffer.from(shot6.data, 'base64'));
    console.log('Saved: purchase_announcement_mobile.png');

    // Trigger Dark Curse modal on mobile
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          if (!window.__gameState || !window.__dispatch) return false;
          window.__gameState.activeEscalationEvent = {
            round: 5,
            multiplier: 2,
            title: 'BÃO LỜI NGUYỄN HẮC ÁM',
            description: 'Voldemort và Tử Thần Thực Tử đã phủ bóng đen lên toàn cõi Hogwarts! Toàn bộ thuế & tiền thuê đất từ nay X2 VĨNH VIỄN!'
          };
          window.__dispatch({ type: 'TOGGLE_TURBO' });
          window.__dispatch({ type: 'TOGGLE_TURBO' });
          return true;
        })()
      `
    });
    await new Promise(r => setTimeout(r, 700));

    const shot7 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('/Users/khang/monopoly/dark_curse_modal_mobile.png', Buffer.from(shot7.data, 'base64'));
    console.log('Saved: dark_curse_modal_mobile.png');

    // Reset viewport back to desktop
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false,
    });

    console.log('All verification screenshots captured successfully!');
    ws.close();
  } catch (err) {
    console.error('Error during verification:', err);
    process.exit(1);
  }
}

main();
