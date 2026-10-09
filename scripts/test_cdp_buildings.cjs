const fs = require('fs');

async function run() {
  const targetsRes = await fetch('http://localhost:9222/json');
  const targets = await targetsRes.json();
  const pageTarget = targets.find(t => t.url.includes('localhost:3000/monopoly'));

  if (!pageTarget) {
    console.error('Monopoly page target not found!');
    process.exit(1);
  }

  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

  let idCounter = 1;
  const pendingRequests = new Map();

  function sendCommand(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = idCounter++;
      pendingRequests.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pendingRequests.has(msg.id)) {
      const { resolve, reject } = pendingRequests.get(msg.id);
      pendingRequests.delete(msg.id);
      if (msg.error) reject(msg.error);
      else resolve(msg.result);
    }
  };

  ws.onopen = async () => {
    console.log('Connected to Chrome CDP!');

    // 1. If in lobby, start solo game
    const checkLobby = await sendCommand('Runtime.evaluate', {
      expression: `Boolean(document.querySelector('.btn-launch-game'))`,
      returnByValue: true
    });

    if (checkLobby.result?.value) {
      console.log('Clicking launch game button...');
      await sendCommand('Runtime.evaluate', {
        expression: `document.querySelector('.btn-launch-game').click()`
      });
      await new Promise(r => setTimeout(r, 1200));
    }

    // 2. Set test building figures state
    console.log('Setting test building figures...');
    const setupEval = await sendCommand('Runtime.evaluate', {
      expression: `(() => {
        if (!window.__gameState || !window.__setGameState) return 'No gameState found';
        window.__setGameState(prev => {
          if (!prev) return prev;
          const p0 = prev.players[0]; // Harry Potter (Gryffindor)
          const p1 = prev.players[1]; // Draco Malfoy (Slytherin)
          const p2 = prev.players[2] || prev.players[0]; // Cedric Diggory or Luna

          return {
            ...prev,
            propertyOwnership: {
              ...prev.propertyOwnership,
              'tile-1': p0.id, // 0 houses -> Royal Flagpost (Gryffindor Red)
              'tile-3': p0.id, // 2 houses -> 2 Cottages (Gryffindor Red)
              'tile-6': p1.id, // 4 houses -> 4 Cottages (Slytherin Green)
              'tile-8': p1.id, // 1 hotel -> Grand Castle (Slytherin Green)
              'tile-9': p2.id, // 0 houses -> Royal Flagpost
            },
            players: prev.players.map(p => {
              if (p.id === p0.id) {
                return {
                  ...p,
                  properties: [...new Set([...p.properties, 'tile-1', 'tile-3'])],
                  houses: { ...p.houses, 'tile-3': 2 },
                  hotels: { ...p.hotels },
                };
              }
              if (p.id === p1.id) {
                return {
                  ...p,
                  properties: [...new Set([...p.properties, 'tile-6', 'tile-8'])],
                  houses: { ...p.houses, 'tile-6': 4 },
                  hotels: { ...p.hotels, 'tile-8': 1 },
                };
              }
              if (p.id === p2.id) {
                return {
                  ...p,
                  properties: [...new Set([...p.properties, 'tile-9'])],
                  houses: { ...p.houses },
                  hotels: { ...p.hotels },
                };
              }
              return p;
            })
          };
        });
        return 'Setup applied successfully!';
      })()`,
      returnByValue: true
    });
    console.log('Eval result:', setupEval.result?.value);

    // 3. Wait 1.8s for 3D meshes to settle and render
    await new Promise(r => setTimeout(r, 1800));

    // 4. Capture screenshot
    console.log('Capturing screenshot...');
    const screenshot = await sendCommand('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(screenshot.data, 'base64');
    const outPath = '/Users/khang/.gemini/antigravity-ide/brain/1307aeb3-dc2d-426b-8ce5-4ea171a9922d/building_figures_verified.png';
    fs.writeFileSync(outPath, buffer);
    console.log('Screenshot saved to:', outPath);

    ws.close();
    process.exit(0);
  };
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
