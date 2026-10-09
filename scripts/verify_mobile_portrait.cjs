const fs = require('fs');

async function verifyMobilePortrait() {
  const targetsRes = await fetch('http://127.0.0.1:9222/json');
  const targets = await targetsRes.json();
  const page = targets.find(t => t.url.includes('localhost:3000'));
  if (!page) {
    console.error('No localhost:3000 page found');
    return;
  }

  const ws = new globalThis.WebSocket(page.webSocketDebuggerUrl);
  let id = 1;
  const send = (method, params = {}) => new Promise((resolve) => {
    const msgId = id++;
    const handler = (evt) => {
      const msg = JSON.parse(evt.data);
      if (msg.id === msgId) {
        ws.removeEventListener('message', handler);
        resolve(msg.result);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });

  await new Promise(r => ws.addEventListener('open', r));

  console.log('1. Setting mobile portrait device metrics (iPhone 14/15 Pro: 393 x 852)...');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 393,
    height: 852,
    deviceScaleFactor: 2,
    mobile: true,
  });

  // Navigate or reload
  await send('Page.reload');
  await new Promise(r => setTimeout(r, 1200));

  // Screenshot 1: Lobby in mobile portrait
  let shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('screen_1_mobile_lobby.png', Buffer.from(shot.data, 'base64'));
  console.log('Saved screen_1_mobile_lobby.png');

  // Launch Solo Game
  console.log('2. Launching solo game in mobile portrait...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const launchBtn = document.querySelector('.btn-launch-game');
      if (launchBtn) launchBtn.click();
    })()`
  });

  await new Promise(r => setTimeout(r, 2000));

  // Screenshot 2: 3D Board & Mobile HUD in Portrait
  shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('screen_2_mobile_board_portrait.png', Buffer.from(shot.data, 'base64'));
  console.log('Saved screen_2_mobile_board_portrait.png');

  // Check board & HUD presence
  const hudCheck = await send('Runtime.evaluate', {
    expression: `(() => {
      const topBar = document.querySelector('.mobile-top-bar');
      const bottomDock = document.querySelector('.mobile-bottom-dock');
      const canvas = document.querySelector('.three-canvas-container canvas');
      const rollBtn = document.querySelector('.btn-primary-roll');
      return {
        topBar: !!topBar,
        bottomDock: !!bottomDock,
        canvas: !!canvas,
        canvasWidth: canvas ? canvas.width : 0,
        canvasHeight: canvas ? canvas.height : 0,
        rollBtnText: rollBtn ? rollBtn.innerText : null,
      };
    })()`,
    returnByValue: true
  });
  console.log('Mobile HUD check:', hudCheck.result.value);

  // Click Roll Dice
  console.log('3. Rolling dice on mobile...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const rollBtn = document.querySelector('.btn-primary-roll');
      if (rollBtn && !rollBtn.disabled) rollBtn.click();
    })()`
  });

  await new Promise(r => setTimeout(r, 2200));

  // Screenshot 3: After rolling dice
  shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('screen_3_mobile_after_roll.png', Buffer.from(shot.data, 'base64'));
  console.log('Saved screen_3_mobile_after_roll.png');

  // Open Bottom Sheet Drawer - Properties Tab
  console.log('4. Opening mobile bottom sheet drawer (Đất Đai)...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const tabs = Array.from(document.querySelectorAll('.mobile-tab-btn'));
      const propTab = tabs.find(t => t.innerText.includes('Đất Đai'));
      if (propTab) propTab.click();
    })()`
  });

  await new Promise(r => setTimeout(r, 600));

  // Screenshot 4: Properties Drawer
  shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('screen_4_mobile_drawer_properties.png', Buffer.from(shot.data, 'base64'));
  console.log('Saved screen_4_mobile_drawer_properties.png');

  // Switch to Leaderboard tab inside drawer
  console.log('5. Switching to Leaderboard tab inside drawer...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const tabs = Array.from(document.querySelectorAll('.mobile-drawer-tabs .tab-btn'));
      const leadTab = tabs.find(t => t.innerText.includes('XẾP HẠNG'));
      if (leadTab) leadTab.click();
    })()`
  });

  await new Promise(r => setTimeout(r, 500));

  // Screenshot 5: Leaderboard Drawer
  shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('screen_5_mobile_drawer_leaderboard.png', Buffer.from(shot.data, 'base64'));
  console.log('Saved screen_5_mobile_drawer_leaderboard.png');

  // Close drawer
  console.log('6. Closing drawer...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const closeBtn = document.querySelector('.mobile-drawer-close-btn');
      if (closeBtn) closeBtn.click();
    })()`
  });

  await new Promise(r => setTimeout(r, 400));

  // Inspect Card Modal on mobile
  console.log('7. Triggering card inspection on mobile (tile index 1: Diagon Alley)...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      if (window.__cards && window.__setInspectedTile) {
        const allCards = window.__cards.getCards();
        if (allCards.length > 1) {
          window.__setInspectedTile(allCards[1].tile);
        }
      }
    })()`
  });

  await new Promise(r => setTimeout(r, 600));

  // Screenshot 6: Card Inspection Modal on mobile
  shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('screen_6_mobile_card_inspect.png', Buffer.from(shot.data, 'base64'));
  console.log('Saved screen_6_mobile_card_inspect.png');

  // Close card modal
  await send('Runtime.evaluate', {
    expression: `(() => {
      const closeBtn = document.querySelector('.card-modal-close-btn') || document.querySelector('.dossier-close-btn');
      if (closeBtn) closeBtn.click();
    })()`
  });

  await new Promise(r => setTimeout(r, 400));

  // Test iPhone SE (375 x 667)
  console.log('8. Testing small phone (iPhone SE: 375 x 667)...');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 375,
    height: 667,
    deviceScaleFactor: 2,
    mobile: true,
  });
  await new Promise(r => setTimeout(r, 600));
  shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('screen_7_mobile_se_portrait.png', Buffer.from(shot.data, 'base64'));
  console.log('Saved screen_7_mobile_se_portrait.png');

  // Test Desktop Restoration (1280 x 800)
  console.log('9. Testing Desktop view restoration (1280 x 800)...');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 800,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await new Promise(r => setTimeout(r, 800));
  shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('screen_8_desktop_restored.png', Buffer.from(shot.data, 'base64'));
  console.log('Saved screen_8_desktop_restored.png');

  ws.close();
  console.log('All mobile portrait verification tests completed successfully!');
}

verifyMobilePortrait().catch(console.error);
