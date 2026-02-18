const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const { db, init } = require('./db');

init();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Serve static frontend
app.use('/', express.static(path.join(__dirname, '..', 'public')));

// Simple search endpoint
app.get('/api/search', (req, res) => {
  const q = (req.query.q || '').trim();
  const stmt = db.prepare(`
    SELECT p.id as product_id, p.name as product_name, p.description, i.id as inventory_id,
           i.qty, i.price, i.characteristics, s.id as shop_id, s.name as shop_name, s.address, s.lat, s.lng
    FROM products p
    JOIN inventory i ON i.product_id = p.id
    JOIN shops s ON s.id = i.shop_id
    WHERE p.name LIKE @q OR p.description LIKE @q OR i.characteristics LIKE @q
    ORDER BY s.name
  `);
  const results = stmt.all({ q: `%${q}%` });
  res.json({ results });
});

// List shops
app.get('/api/shops', (req, res) => {
  const shops = db.prepare('SELECT * FROM shops').all();
  res.json({ shops });
});

// Reserve product
app.post('/api/reserve', (req, res) => {
  const { inventory_id, qty, customer_name, customer_phone } = req.body;
  if (!inventory_id || !qty) return res.status(400).json({ error: 'inventory_id and qty required' });

  const inv = db.prepare('SELECT * FROM inventory WHERE id = ?').get(inventory_id);
  if (!inv) return res.status(404).json({ error: 'inventory not found' });
  if (inv.qty < qty) return res.status(409).json({ error: 'not enough stock' });

  const insert = db.prepare('INSERT INTO reservations (shop_id, product_id, qty, customer_name, customer_phone) VALUES (?, ?, ?, ?, ?)');
  const info = insert.run(inv.shop_id, inv.product_id, qty, customer_name || '', customer_phone || '');

  const update = db.prepare('UPDATE inventory SET qty = qty - ? WHERE id = ?');
  update.run(qty, inventory_id);

  res.json({ ok: true, reservationId: info.lastInsertRowid });
});

// AI agent mock endpoint: tries to confirm availability with shop (simulated)
app.post('/api/ai-agent', (req, res) => {
  const { inventory_id } = req.body;
  if (!inventory_id) return res.status(400).json({ error: 'inventory_id required' });

  const inv = db.prepare('SELECT i.*, s.name as shop_name FROM inventory i JOIN shops s ON s.id = i.shop_id WHERE i.id = ?').get(inventory_id);
  if (!inv) return res.status(404).json({ error: 'inventory not found' });

  // Simulate: if qty > 0 return available; else "call" shop and set qty=1 to simulate confirmation
  if (inv.qty > 0) {
    return res.json({ ok: true, available: true, qty: inv.qty });
  }

  // Simulate contacting the shop (placeholder for Twilio/OpenAI integration)
  // In a real implementation we'd call Twilio Voice / WhatsApp / OpenAI Realtime here.
  const update = db.prepare('UPDATE inventory SET qty = 1 WHERE id = ?');
  update.run(inventory_id);

  res.json({ ok: true, available: true, qty: 1, note: `Simulated contact with ${inv.shop_name}` });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
