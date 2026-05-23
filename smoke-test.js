(async ()=>{
  const base='http://localhost:3000';
  const pRes = await fetch(`${base}/api/products`);
  if (!pRes.ok) { console.error('products fetch failed', pRes.status, await pRes.text()); process.exit(1); }
  const pJson = await pRes.json();
  console.log('products', Array.isArray(pJson.products) ? pJson.products.length : 'unknown');
  const first = pJson.products[0];
  const wh = first.warehouses[0];
  const payload = { productId: first.id, warehouseId: wh.warehouseId, quantity: 1 };

  let r = await fetch(`${base}/api/reservations`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload)
  });
  console.log('reserve status', r.status);
  const reserveText = await r.text();
  try { const reserveJson = JSON.parse(reserveText); console.log('reserve id', reserveJson.reservation.id); 
    try {
      const c = await fetch(`${base}/api/reservations/${reserveJson.reservation.id}/confirm`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({}) });
      console.log('confirm status', c.status, await c.text());
    } catch(e){ console.error('confirm error', e.message); }
  } catch(e) { console.log('reserve body (non-json):', reserveText); }

  const big = { ...payload, quantity: 999999 };
  const o = await fetch(`${base}/api/reservations`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(big) });
  console.log('overreserve status', o.status, await o.text());
})();
