const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'data.sqlite'));

function init() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS shops (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      address TEXT,
      lat REAL,
      lng REAL
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      sku TEXT,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_id INTEGER,
      product_id INTEGER,
      qty INTEGER,
      price REAL,
      characteristics TEXT,
      FOREIGN KEY(shop_id) REFERENCES shops(id),
      FOREIGN KEY(product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_id INTEGER,
      product_id INTEGER,
      qty INTEGER,
      customer_name TEXT,
      customer_phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed sample data if empty
  const shopCount = db.prepare('SELECT COUNT(1) as c FROM shops').get().c;
  if (!shopCount) {
    const insertShop = db.prepare('INSERT INTO shops (name, address, lat, lng) VALUES (?, ?, ?, ?)');
    insertShop.run('Tarigo', 'Via Roma 1, Genova', 44.4056, 8.9463);
    insertShop.run('Ikea', 'Viale Internazionale 2', 44.4100, 8.9500);
    insertShop.run('Bottega Torrielli', 'P.za Piccola 3, Genova', 44.4070, 8.9440);

    const insertProduct = db.prepare('INSERT INTO products (name, sku, description) VALUES (?, ?, ?)');
    insertProduct.run('Pentola in ghisa 32cm', 'GH-32', 'Pentola in ghisa, 32cm, capienza 5L');
    insertProduct.run('Set posate 24pz', 'POS-24', 'Set posate inox');
    insertProduct.run('Farina tipo 0 1kg', 'FAR-1', 'Farina tipo 0 per pane');

    const insertInventory = db.prepare('INSERT INTO inventory (shop_id, product_id, qty, price, characteristics) VALUES (?, ?, ?, ?, ?)');
    // Tarigo
    insertInventory.run(1, 1, 2, 130.0, 'ghisa;32cm;manico ergonomico');
    insertInventory.run(1, 3, 10, 2.5, 'farina;1kg;tipo0');
    // Ikea
    insertInventory.run(2, 1, 5, 115.0, 'ghisa;32cm;marcaIkea');
    insertInventory.run(2, 2, 20, 24.9, 'posate;inox;24pz');
    // Torrielli
    insertInventory.run(3, 3, 0, 3.5, 'farina;1kg;tipo0;sfuso');
  }
}

module.exports = { db, init };
