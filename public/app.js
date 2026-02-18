async function search(q) {
  const res = await fetch('/api/search?q=' + encodeURIComponent(q));
  return res.json();
}

function render(results) {
  const el = document.getElementById('results');
  el.innerHTML = '';
  if (!results.length) return el.innerHTML = '<p>No results</p>';

  results.forEach(r => {
    const d = document.createElement('div');
    d.className = 'result';
    d.innerHTML = `<strong>${r.product_name}</strong> — ${r.characteristics || ''}<br/>
      <em>${r.shop_name}</em> — ${r.address}<br/>
      Price: €${r.price} — Qty: ${r.qty}<br/>
      <button data-inv="${r.inventory_id}">Reserve 1</button>
      <button data-agent="${r.inventory_id}">Ask AI Agent</button>
    `;
    el.appendChild(d);
  });

  // attach handlers
  el.querySelectorAll('button[data-inv]').forEach(b => {
    b.addEventListener('click', async () => {
      const inv = b.getAttribute('data-inv');
      const res = await fetch('/api/reserve', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ inventory_id: parseInt(inv), qty:1, customer_name:'Test', customer_phone:'+' })});
      const data = await res.json();
      alert(JSON.stringify(data));
      b.disabled = true;
    });
  });

  el.querySelectorAll('button[data-agent]').forEach(b => {
    b.addEventListener('click', async () => {
      const inv = b.getAttribute('data-agent');
      const res = await fetch('/api/ai-agent', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ inventory_id: parseInt(inv) })});
      const data = await res.json();
      alert(JSON.stringify(data));
      // refresh search
      document.getElementById('btn').click();
    });
  });
}

document.getElementById('btn').addEventListener('click', async () => {
  const q = document.getElementById('q').value;
  const data = await search(q);
  render(data.results || []);
});

// quick search on load
document.getElementById('q').value = 'Pentola';
document.getElementById('btn').click();
