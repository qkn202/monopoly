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

    // Reset viewport to desktop
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false,
    });

    // 1. Dismiss any open card modal and setup rent test state
    const setupResult = await send('Runtime.evaluate', {
      expression: `
        (() => {
          let s = window.__gameState;
          if (!s || !window.__setGameState) return { error: 'No gameState' };

          const owner = {
            ...s.players[0],
            properties: ['tile-1'],
            houses: { 'tile-1': 1 },
            balance: 1510
          };
          const debtor = {
            ...s.players[1],
            position: 1,
            balance: 1490
          };

          const rentPayment = {
            debtorId: debtor.id,
            creditorId: owner.id,
            amount: 10,
            tileId: 'tile-1',
            timestamp: Date.now(),
            isTax: false
          };

          const testState = {
            ...s,
            players: [owner, debtor, ...s.players.slice(2)],
            propertyOwnership: { ...s.propertyOwnership, 'tile-1': owner.id },
            currentPlayerIndex: 1, // Draco's turn
            turnPhase: 'END_TURN',
            activeCard: null, // Ensure modal is closed
            lastRentPayment: rentPayment,
            events: [
              {
                id: 'test-rent-' + Date.now(),
                timestamp: Date.now(),
                message: '💸 Draco Malfoy dừng chân tại đất của Harry Potter và đã trả 10 Galleons tiền thuê "Borgin & Burkes"!',
                type: 'warning',
                playerId: debtor.id
              },
              ...s.events
            ]
          };

          window.__setGameState(testState);
          return {
            ownerBalance: testState.players[0].balance,
            debtorBalance: testState.players[1].balance,
            lastRentPayment: testState.lastRentPayment,
            latestEvent: testState.events[0].message
          };
        })()
      `,
      returnByValue: true
    });

    console.log('Setup Rent State:', setupResult.result?.value);

    // Wait 700ms for DOM render
    await new Promise(r => setTimeout(r, 700));

    // 2. Inspect DOM for rent elements
    const domCheck = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const rentBanner = document.querySelector('.rent-announcement-banner');
          const receiptCard = document.querySelector('.landed-receipt-card.rent-paid');
          const receiptBadge = document.querySelector('.receipt-badge-rent');
          const receiptAmount = document.querySelector('.receipt-amount-neg');
          const ruleFootnote = document.querySelector('.rules-tax-footnote');
          
          return {
            hasRentBanner: !!rentBanner,
            bannerText: rentBanner ? rentBanner.innerText.replace(/\\s+/g, ' ').trim() : null,
            hasReceiptCard: !!receiptCard,
            receiptCardText: receiptCard ? receiptCard.innerText.replace(/\\s+/g, ' ').trim() : null,
            receiptBadge: receiptBadge ? receiptBadge.innerText : null,
            receiptAmount: receiptAmount ? receiptAmount.innerText : null,
            hasFootnote: !!ruleFootnote,
            footnoteText: ruleFootnote ? ruleFootnote.innerText.replace(/\\s+/g, ' ').trim() : null
          };
        })()
      `,
      returnByValue: true
    });

    console.log('DOM Rent Check Results:', JSON.stringify(domCheck.result?.value, null, 2));

    // Capture visual screenshot of Rent Payment
    const shot1 = await send('Page.captureScreenshot', { format: 'png' });
    const shotPath1 = '/Users/khang/.gemini/antigravity-ide/brain/1307aeb3-dc2d-426b-8ce5-4ea171a9922d/rent_payment_desktop.png';
    fs.writeFileSync(shotPath1, Buffer.from(shot1.data, 'base64'));
    console.log('Screenshot 1 saved to:', shotPath1);

    // 3. Test TAX payment scenario:
    // Harry lands on tile-4 ('Thuế Thẩm Định Pháp Thuật', price: 100G)
    const testTaxResult = await send('Runtime.evaluate', {
      expression: `
        (() => {
          let s = window.__gameState;
          const player = {
            ...s.players[0],
            position: 4,
            balance: 1400
          };

          const taxPayment = {
            debtorId: player.id,
            amount: 100,
            tileId: 'tile-4',
            timestamp: Date.now() + 50,
            isTax: true
          };

          const taxState = {
            ...s,
            players: [player, ...s.players.slice(1)],
            currentPlayerIndex: 0,
            turnPhase: 'END_TURN',
            activeCard: null,
            freeParkingPot: s.freeParkingPot + 100,
            lastRentPayment: taxPayment,
            events: [
              {
                id: 'test-tax-' + Date.now(),
                timestamp: Date.now(),
                message: '⚖️ Harry Potter đã nộp 100 Galleons thuế tại "Thuế Thẩm Định Pháp Thuật"!',
                type: 'info',
                playerId: player.id
              },
              ...s.events
            ]
          };

          window.__setGameState(taxState);
          return {
            taxPlayerBal: player.balance,
            freeParkingPot: taxState.freeParkingPot
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Test Tax State:', testTaxResult.result?.value);

    await new Promise(r => setTimeout(r, 700));

    const domTaxCheck = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const rentBanner = document.querySelector('.rent-announcement-banner.is-tax');
          const receiptCard = document.querySelector('.landed-receipt-card.tax-paid');
          const receiptBadge = document.querySelector('.receipt-badge-tax');
          const receiptAmount = document.querySelector('.receipt-amount-neg');
          
          return {
            hasTaxBanner: !!rentBanner,
            bannerText: rentBanner ? rentBanner.innerText.replace(/\\s+/g, ' ').trim() : null,
            hasReceiptCard: !!receiptCard,
            receiptCardText: receiptCard ? receiptCard.innerText.replace(/\\s+/g, ' ').trim() : null,
            receiptBadge: receiptBadge ? receiptBadge.innerText : null,
            receiptAmount: receiptAmount ? receiptAmount.innerText : null
          };
        })()
      `,
      returnByValue: true
    });
    console.log('DOM Tax Check Results:', JSON.stringify(domTaxCheck.result?.value, null, 2));

    const shot2 = await send('Page.captureScreenshot', { format: 'png' });
    const shotPath2 = '/Users/khang/.gemini/antigravity-ide/brain/1307aeb3-dc2d-426b-8ce5-4ea171a9922d/tax_payment_desktop.png';
    fs.writeFileSync(shotPath2, Buffer.from(shot2.data, 'base64'));
    console.log('Screenshot 2 saved to:', shotPath2);

    // 4. Test Mobile Portrait View (iPhone 14/15 Pro: 393 x 852)
    console.log('Testing Mobile Portrait View for Rent Receipt...');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 393,
      height: 852,
      deviceScaleFactor: 2,
      mobile: true,
    });

    await new Promise(r => setTimeout(r, 600));

    const shot3 = await send('Page.captureScreenshot', { format: 'png' });
    const shotPath3 = '/Users/khang/.gemini/antigravity-ide/brain/1307aeb3-dc2d-426b-8ce5-4ea171a9922d/rent_payment_mobile_portrait.png';
    fs.writeFileSync(shotPath3, Buffer.from(shot3.data, 'base64'));
    console.log('Screenshot 3 saved to:', shotPath3);

    // Reset back to desktop
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false,
    });

    ws.close();
    console.log('All verification steps completed successfully!');
  } catch (err) {
    console.error('Error running test:', err);
    process.exit(1);
  }
}

main();
