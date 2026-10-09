const fs = require('fs');

async function testMobile() {
  const targetsRes = await fetch('http://127.0.0.1:9222/json');
  const targets = await targetsRes.json();
  const page = targets.find(t => t.url.includes('localhost:3000'));
  if (!page) {
    console.error('No page found');
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

  // Emulate iPhone 14 Pro: 393 x 852
  await send('Emulation.setDeviceMetricsOverride', {
    width: 393,
    height: 852,
    deviceScaleFactor: 2,
    mobile: true,
  });

  // Evaluate current state
  const evalRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const layout = document.querySelector('.main-game-layout');
      const sidebar = document.querySelector('.right-sidebar');
      const canvas = document.querySelector('.three-canvas-container canvas');
      const lobby = document.querySelector('.lobby-overlay');
      return {
        hasLobby: !!lobby,
        layoutRect: layout ? layout.getBoundingClientRect() : null,
        sidebarRect: sidebar ? sidebar.getBoundingClientRect() : null,
        canvasRect: canvas ? canvas.getBoundingClientRect() : null,
      };
    })()`,
    returnByValue: true
  });
  console.log('DOM Evaluation:', evalRes.result.value);

  // Capture screenshot
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('mobile_current_state.png', Buffer.from(shot.data, 'base64'));
  console.log('Saved mobile_current_state.png');

  ws.close();
}

testMobile().catch(console.error);
