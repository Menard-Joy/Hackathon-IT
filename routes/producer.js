// producer.routes.js
const express = require('express');
const pool = require('./db');
const { ensureAuth, ensureProducer } = require('./auth');
const bcrypt = require('bcrypt');

const router = express.Router();

// All routes assume req.user exists and has { user_id, role }
// Attach ensureAuth and ensureProducer to all producer routes
router.use(ensureAuth, ensureProducer);

/* --------------------------
   Lookup endpoints
   -------------------------- */
// GET /producer/lookups/categories
router.get('/lookups/categories', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT category_id, name FROM ProductCategories ORDER BY name');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

// GET /producer/lookups/expiry-types
router.get('/lookups/expiry-types', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT expiry_type_id, name FROM ExpiryTypes ORDER BY name');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

// GET /producer/lookups/taluks
router.get('/lookups/taluks', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT taluk_id, name FROM Taluks ORDER BY name');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

/* --------------------------
   Product CRUD
   -------------------------- */
/*
 Expected POST body for create:
 {
   name, description, price, quantity,
   category_id, expiry_type_id, taluk_id
 }
*/
router.post('/products', async (req, res) => {
  const producer_id = req.user.user_id;
  const { name, description, price, quantity, category_id, expiry_type_id, taluk_id } = req.body;
  if (!name || price == null || category_id == null || expiry_type_id == null || taluk_id == null) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const sql = `INSERT INTO Products
      (producer_id, name, description, price, quantity, category_id, expiry_type_id, taluk_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    const [result] = await pool.execute(sql, [producer_id, name, description || null, price, quantity || 0, category_id, expiry_type_id, taluk_id]);
    const insertedId = result.insertId;
    const [rows] = await pool.query('SELECT * FROM Products WHERE product_id = ?', [insertedId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

// GET /producer/products  -> list all products for this producer
router.get('/products', async (req, res) => {
  const producer_id = req.user.user_id;
  try {
    const sql = `
      SELECT p.*, pc.name AS category_name, et.name AS expiry_name, t.name AS taluk_name
      FROM Products p
      LEFT JOIN ProductCategories pc ON p.category_id = pc.category_id
      LEFT JOIN ExpiryTypes et ON p.expiry_type_id = et.expiry_type_id
      LEFT JOIN Taluks t ON p.taluk_id = t.taluk_id
      WHERE p.producer_id = ?
      ORDER BY p.product_id DESC
    `;
    const [rows] = await pool.execute(sql, [producer_id]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

// GET /producer/products/:id  -> single product (must belong to producer)
router.get('/products/:id', async (req, res) => {
  const producer_id = req.user.user_id;
  const pid = req.params.id;
  try {
    const sql = `SELECT p.*, pc.name AS category_name, et.name AS expiry_name, t.name AS taluk_name
      FROM Products p
      LEFT JOIN ProductCategories pc ON p.category_id = pc.category_id
      LEFT JOIN ExpiryTypes et ON p.expiry_type_id = et.expiry_type_id
      LEFT JOIN Taluks t ON p.taluk_id = t.taluk_id
      WHERE p.product_id = ? AND p.producer_id = ?`;
    const [rows] = await pool.execute(sql, [pid, producer_id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

/*
 Update product:
 body may contain any of: name, description, price, quantity, category_id, expiry_type_id, taluk_id
*/
router.put('/products/:id', async (req, res) => {
  const producer_id = req.user.user_id;
  const pid = req.params.id;
  const allowed = ['name','description','price','quantity','category_id','expiry_type_id','taluk_id'];
  const updates = [];
  const params = [];

  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(req.body, key)) {
      updates.push(`${key} = ?`);
      params.push(req.body[key]);
    }
  }
  if (updates.length === 0) {
    return res.status(400).json({ error: 'No updatable fields provided' });
  }
  params.push(pid, producer_id);

  try {
    const sql = `UPDATE Products SET ${updates.join(', ')} WHERE product_id = ? AND producer_id = ?`;
    const [result] = await pool.execute(sql, params);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Product not found or not owned by you' });
    const [rows] = await pool.query('SELECT * FROM Products WHERE product_id = ?', [pid]);
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

// DELETE /producer/products/:id
router.delete('/products/:id', async (req, res) => {
  const producer_id = req.user.user_id;
  const pid = req.params.id;
  try {
    const [result] = await pool.execute('DELETE FROM Products WHERE product_id = ? AND producer_id = ?', [pid, producer_id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Product not found or not owned by you' });
    res.json({ success: true, deleted: pid });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

/* --------------------------
   Inventory: update quantity
   -------------------------- */
// PATCH /producer/products/:id/quantity  body: { quantity: number }
router.patch('/products/:id/quantity', async (req, res) => {
  const producer_id = req.user.user_id;
  const pid = req.params.id;
  const { quantity } = req.body;
  if (quantity == null || !Number.isInteger(quantity) || quantity < 0) {
    return res.status(400).json({ error: 'quantity must be non-negative integer' });
  }
  try {
    const [result] = await pool.execute('UPDATE Products SET quantity = ? WHERE product_id = ? AND producer_id = ?', [quantity, pid, producer_id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Product not found or not owned by you' });
    const [rows] = await pool.query('SELECT product_id, quantity FROM Products WHERE product_id = ?', [pid]);
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

/* --------------------------
   Orders & Transactions
   --------------------------
   We will return only order items that belong to this producer.
   GET /producer/orders  -> list orders which include at least one item from this producer
   GET /producer/orders/:orderId -> details for that order (only items belonging to producer)
*/
router.get('/orders', async (req, res) => {
  const producer_id = req.user.user_id;
  try {
    const sql = `
      SELECT DISTINCT o.order_id, o.order_date, o.total_amount, o.consumer_id, u.name AS consumer_name, u.email AS consumer_email
      FROM Orders o
      JOIN OrderItems oi ON o.order_id = oi.order_id
      JOIN Products p ON oi.product_id = p.product_id
      LEFT JOIN Users u ON o.consumer_id = u.user_id
      WHERE p.producer_id = ?
      ORDER BY o.order_date DESC
      LIMIT 200
    `;
    const [rows] = await pool.execute(sql, [producer_id]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

router.get('/orders/:orderId', async (req, res) => {
  const producer_id = req.user.user_id;
  const oid = req.params.orderId;
  try {
    // return order-level info + only the OrderItems for this producer
    const [orderRows] = await pool.execute('SELECT order_id, order_date, total_amount, consumer_id FROM Orders WHERE order_id = ?', [oid]);
    if (orderRows.length === 0) return res.status(404).json({ error: 'Order not found' });

    const [items] = await pool.execute(`
      SELECT oi.order_item_id, oi.product_id, oi.quantity, oi.unit_price, p.name as product_name, p.producer_id
      FROM OrderItems oi
      JOIN Products p ON oi.product_id = p.product_id
      WHERE oi.order_id = ? AND p.producer_id = ?
    `, [oid, producer_id]);

    // If there are no items for this producer, forbid viewing
    if (items.length === 0) return res.status(403).json({ error: 'This order does not contain any item from you' });

    // get consumer info
    const [consumerRows] = await pool.execute('SELECT user_id, name, email FROM Users WHERE user_id = ?', [orderRows[0].consumer_id]);
    res.json({
      order: orderRows[0],
      consumer: consumerRows[0] || null,
      items
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

/* --------------------------
   Favorites: who favorited your products
   -------------------------- */
// GET /producer/favorites -> list consumers who favorited any product of this producer
router.get('/favorites', async (req, res) => {
  const producer_id = req.user.user_id;
  try {
    const sql = `
      SELECT DISTINCT f.consumer_id, u.name AS consumer_name, u.email AS consumer_email, f.product_id, p.name AS product_name, f.added_at
      FROM Favorites f
      JOIN Products p ON f.product_id = p.product_id
      JOIN Users u ON f.consumer_id = u.user_id
      WHERE p.producer_id = ?
      ORDER BY f.added_at DESC
      LIMIT 500
    `;
    const [rows] = await pool.execute(sql, [producer_id]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

/* --------------------------
   Profile: view & change password
   -------------------------- */
// GET /producer/profile
router.get('/profile', async (req, res) => {
  const producer_id = req.user.user_id;
  try {
    const [rows] = await pool.execute('SELECT user_id, name, email, role FROM Users WHERE user_id = ?', [producer_id]);
    res.json(rows[0] || null);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

// POST /producer/change-password { old_password, new_password }
router.post('/change-password', async (req, res) => {
  const producer_id = req.user.user_id;
  const { old_password, new_password } = req.body;
  if (!old_password || !new_password) return res.status(400).json({ error: 'old_password and new_password required' });

  try {
    const [rows] = await pool.execute('SELECT password_hash FROM Users WHERE user_id = ?', [producer_id]);
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const hash = rows[0].password_hash;
    const ok = await bcrypt.compare(old_password, hash);
    if (!ok) return res.status(403).json({ error: 'Old password incorrect' });

    const newHash = await bcrypt.hash(new_password, 10);
    await pool.execute('UPDATE Users SET password_hash = ? WHERE user_id = ?', [newHash, producer_id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

/* --------------------------
   Small Dashboard / Stats
   -------------------------- */
router.get('/dashboard', async (req, res) => {
  const producer_id = req.user.user_id;
  try {
    const [[{ product_count }]] = await pool.execute('SELECT COUNT(*) as product_count FROM Products WHERE producer_id = ?', [producer_id]);
    const [[{ orders_count }]] = await pool.execute(`
      SELECT COUNT(DISTINCT o.order_id) as orders_count
      FROM Orders o
      JOIN OrderItems oi ON o.order_id = oi.order_id
      JOIN Products p ON oi.product_id = p.product_id
      WHERE p.producer_id = ?
    `, [producer_id]);
    const [[{ fav_count }]] = await pool.execute(`
      SELECT COUNT(DISTINCT f.consumer_id) as fav_count
      FROM Favorites f
      JOIN Products p ON f.product_id = p.product_id
      WHERE p.producer_id = ?
    `, [producer_id]);

    res.json({
      product_count,
      orders_count,
      fav_count
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

module.exports = router;