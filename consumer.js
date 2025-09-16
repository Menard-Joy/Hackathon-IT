// consumer.routes.js
const express = require('express');
const pool = require('./db'); // mysql2/promise pool
const { ensureAuth } = require('./auth'); // ensureAuth should check req.user exists
const router = express.Router();

// Ensure the user is authenticated and is a Consumer
router.use(ensureAuth, (req, res, next) => {
  if (!req.user || req.user.role !== 'Consumer') {
    return res.status(403).json({ error: 'Access allowed for consumers only' });
  }
  next();
});

/* ---------------------------
   Helpers
   --------------------------- */
async function getOrCreateCart(consumerId) {
  // Try to get most recent cart; if none, create one
  const [rows] = await pool.query('SELECT cart_id FROM Carts WHERE consumer_id = ? ORDER BY created_at DESC LIMIT 1', [consumerId]);
  if (rows.length) return rows[0].cart_id;
  const [r2] = await pool.execute('INSERT INTO Carts (consumer_id) VALUES (?)', [consumerId]);
  return r2.insertId;
}

async function productBaseQuery() {
  // base product select with joins for category, expiry, taluk and producer info
  return `
    SELECT
      p.product_id,
      p.name,
      p.description,
      p.price,
      p.quantity,
      p.category_id,
      pc.name AS category_name,
      p.expiry_type_id,
      et.name AS expiry_name,
      p.taluk_id,
      t.name AS taluk_name,
      p.producer_id,
      u.name AS producer_name,
      u.email AS producer_email
    FROM Products p
    LEFT JOIN ProductCategories pc ON p.category_id = pc.category_id
    LEFT JOIN ExpiryTypes et ON p.expiry_type_id = et.expiry_type_id
    LEFT JOIN Taluks t ON p.taluk_id = t.taluk_id
    LEFT JOIN Users u ON p.producer_id = u.user_id
  `;
}

/* ---------------------------
   Product Feed (search & filters)
   - Default: only products in consumer taluk (req.user.taluk_id) OR taluk_id query param
   - Optional query param include_other=true to include other taluks
   - Search: q (name or description)
   - Filters: category_id, expiry_type_id
   - Pagination: page, limit
   --------------------------- */
router.get('/products', async (req, res) => {
  try {
    const consumerId = req.user.user_id;
    const consumerTaluk = req.user.taluk_id || null; // may be undefined
    const {
      q,
      category_id,
      expiry_type_id,
      taluk_id, // explicit taluk they want to view (optional)
      include_other, // 'true' to allow other taluks
      page = 1,
      limit = 20,
      sort = 'newest' // 'price_asc', 'price_desc', 'newest'
    } = req.query;

    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
    const params = [];
    let where = ' WHERE 1=1 ';

    // If consumer taluk exists and include_other not true, limit by consumer taluk or explicit taluk param
    if (include_other !== 'true') {
      // prefer explicit taluk_id param if provided; else use consumerTaluk
      const talukFilter = taluk_id || consumerTaluk;
      if (talukFilter) {
        where += ' AND p.taluk_id = ?';
        params.push(talukFilter);
      } else {
        // No taluk info available: don't apply taluk filter
      }
    } else {
      // include_other === 'true' -> if taluk_id provided, filter by that, else no taluk filter (all taluks)
      if (taluk_id) {
        where += ' AND p.taluk_id = ?';
        params.push(taluk_id);
      }
    }

    if (q) {
      where += ' AND (p.name LIKE ? OR p.description LIKE ?)';
      params.push('%' + q + '%', '%' + q + '%');
    }
    if (category_id) {
      where += ' AND p.category_id = ?';
      params.push(category_id);
    }
    if (expiry_type_id) {
      where += ' AND p.expiry_type_id = ?';
      params.push(expiry_type_id);
    }

    // only show available items (quantity > 0)
    where += ' AND p.quantity > 0';

    let orderBy = ' ORDER BY p.product_id DESC ';
    if (sort === 'price_asc') orderBy = ' ORDER BY p.price ASC ';
    if (sort === 'price_desc') orderBy = ' ORDER BY p.price DESC ';

    const base = await productBaseQuery();
    const sql = `${base} ${where} ${orderBy} LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    const [rows] = await pool.execute(sql, params);

    // Add consumer-specific flags: favorite, in_cart_quantity
    // Build a map of product ids
    const prodIds = rows.map(r => r.product_id);
    let favMap = {};
    let cartMap = {};
    if (prodIds.length) {
      // favorites
      const [frows] = await pool.query(`SELECT product_id FROM Favorites WHERE consumer_id = ? AND product_id IN (${prodIds.map(() => '?').join(',')})`, [consumerId, ...prodIds]);
      frows.forEach(f => { favMap[f.product_id] = true; });

      // cart items for latest cart
      const [cartRows] = await pool.query(`
        SELECT ci.product_id, ci.quantity
        FROM CartItems ci
        JOIN Carts c ON ci.cart_id = c.cart_id
        WHERE c.consumer_id = ?
          AND ci.product_id IN (${prodIds.map(() => '?').join(',')})
      `, [consumerId, ...prodIds]);
      cartRows.forEach(c => { cartMap[c.product_id] = c.quantity; });
    }

    const enriched = rows.map(r => ({
      ...r,
      is_favorite: !!favMap[r.product_id],
      in_cart_quantity: cartMap[r.product_id] || 0
    }));

    res.json({ page: parseInt(page), limit: parseInt(limit), results: enriched });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

/* ---------------------------
   Product detail (with producer contact)
   --------------------------- */
router.get('/products/:id', async (req, res) => {
  try {
    const consumerId = req.user.user_id;
    const productId = req.params.id;

    const base = await productBaseQuery();
    const [rows] = await pool.execute(`${base} WHERE p.product_id = ?`, [productId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    const product = rows[0];

    // check if product is allowed to be shown (optional: enforce taluk filter outside)
    // Provide favorite & cart status
    const [[ fav ]] = await pool.query('SELECT COUNT(*) as c FROM Favorites WHERE consumer_id = ? AND product_id = ?', [consumerId, productId]);
    const [[ cartCount ]] = await pool.query(`
      SELECT IFNULL(SUM(ci.quantity),0) as qty
      FROM CartItems ci
      JOIN Carts c ON ci.cart_id = c.cart_id
      WHERE c.consumer_id = ? AND ci.product_id = ?
    `, [consumerId, productId]);

    product.is_favorite = fav.c > 0;
    product.in_cart_quantity = cartCount.qty || 0;

    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

/* ---------------------------
   Contact producer endpoint
   (This simply returns the producer contact info available in Users table.)
   If you want messaging or email-sending, add that separately (outgoing email service).
   --------------------------- */
router.get('/products/:id/contact', async (req, res) => {
  try {
    const productId = req.params.id;
    const [rows] = await pool.query(`
      SELECT u.user_id AS producer_id, u.name AS producer_name, u.email AS producer_email, t.taluk_id, t.name AS taluk_name
      FROM Products p
      JOIN Users u ON p.producer_id = u.user_id
      LEFT JOIN Taluks t ON p.taluk_id = t.taluk_id
      WHERE p.product_id = ?
    `, [productId]);

    if (rows.length === 0) return res.status(404).json({ error: 'Product/Producer not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

/* ---------------------------
   Favorites (wishlist)
   - POST /favorites { product_id }
   - DELETE /favorites/:product_id
   - GET /favorites
   --------------------------- */
router.post('/favorites', async (req, res) => {
  try {
    const consumerId = req.user.user_id;
    const { product_id } = req.body;
    if (!product_id) return res.status(400).json({ error: 'product_id required' });

    // INSERT IGNORE to avoid duplicates (MySQL). If your server mode doesn't support IGNORE, check before inserting.
    await pool.execute('INSERT IGNORE INTO Favorites (consumer_id, product_id) VALUES (?, ?)', [consumerId, product_id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

router.delete('/favorites/:product_id', async (req, res) => {
  try {
    const consumerId = req.user.user_id;
    const pid = req.params.product_id;
    const [result] = await pool.execute('DELETE FROM Favorites WHERE consumer_id = ? AND product_id = ?', [consumerId, pid]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found in favorites' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

router.get('/favorites', async (req, res) => {
  try {
    const consumerId = req.user.user_id;
    const [rows] = await pool.query(`
      SELECT f.product_id, p.name, p.price, p.quantity, p.taluk_id, t.name AS taluk_name, p.producer_id
      FROM Favorites f
      JOIN Products p ON f.product_id = p.product_id
      LEFT JOIN Taluks t ON p.taluk_id = t.taluk_id
      WHERE f.consumer_id = ?
      ORDER BY f.added_at DESC
    `, [consumerId]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

/* ---------------------------
   Cart endpoints
   - GET /cart
   - POST /cart/items  { product_id, quantity }  (add or increment)
   - PATCH /cart/items/:cart_item_id  { quantity }  (update)
   - DELETE /cart/items/:cart_item_id
   --------------------------- */
router.get('/cart', async (req, res) => {
  try {
    const consumerId = req.user.user_id;
    const [rows] = await pool.query(`
      SELECT ci.cart_item_id, ci.product_id, ci.quantity, p.name, p.price, p.quantity as product_stock, p.producer_id, t.name as taluk_name
      FROM CartItems ci
      JOIN Carts c ON ci.cart_id = c.cart_id
      JOIN Products p ON ci.product_id = p.product_id
      LEFT JOIN Taluks t ON p.taluk_id = t.taluk_id
      WHERE c.consumer_id = ?
    `, [consumerId]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

router.post('/cart/items', async (req, res) => {
  try {
    const consumerId = req.user.user_id;
    const { product_id, quantity } = req.body;
    if (!product_id || !Number.isInteger(quantity) || quantity <= 0) {
      return res.status(400).json({ error: 'product_id and positive integer quantity required' });
    }

    // Check stock
    const [[prod]] = await pool.query('SELECT quantity FROM Products WHERE product_id = ?', [product_id]);
    if (!prod) return res.status(404).json({ error: 'Product not found' });
    if (prod.quantity < quantity) return res.status(400).json({ error: 'Insufficient stock' });

    const cartId = await getOrCreateCart(consumerId);

    // If cart item exists, update quantity (add)
    const [existing] = await pool.query('SELECT cart_item_id, quantity FROM CartItems WHERE cart_id = ? AND product_id = ?', [cartId, product_id]);
    if (existing.length) {
      const newQty = existing[0].quantity + quantity;
      await pool.execute('UPDATE CartItems SET quantity = ? WHERE cart_item_id = ?', [newQty, existing[0].cart_item_id]);
      const [[row]] = await pool.query('SELECT cart_item_id, product_id, quantity FROM CartItems WHERE cart_item_id = ?', [existing[0].cart_item_id]);
      return res.status(200).json(row);
    } else {
      const [r] = await pool.execute('INSERT INTO CartItems (cart_id, product_id, quantity) VALUES (?, ?, ?)', [cartId, product_id, quantity]);
      const [row] = await pool.query('SELECT cart_item_id, product_id, quantity FROM CartItems WHERE cart_item_id = ?', [r.insertId]);
      return res.status(201).json(row[0]);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

router.patch('/cart/items/:cart_item_id', async (req, res) => {
  try {
    const consumerId = req.user.user_id;
    const cartItemId = req.params.cart_item_id;
    const { quantity } = req.body;
    if (quantity == null || !Number.isInteger(quantity) || quantity < 0) {
      return res.status(400).json({ error: 'quantity must be non-negative integer' });
    }

    // Verify cart item belongs to this consumer
    const [rows] = await pool.query(`
      SELECT ci.*, p.quantity AS product_stock
      FROM CartItems ci
      JOIN Carts c ON ci.cart_id = c.cart_id
      JOIN Products p ON ci.product_id = p.product_id
      WHERE ci.cart_item_id = ? AND c.consumer_id = ?
    `, [cartItemId, consumerId]);

    if (rows.length === 0) return res.status(404).json({ error: 'CartItem not found' });
    const item = rows[0];
    if (quantity > item.product_stock) return res.status(400).json({ error: 'Insufficient product stock' });

    if (quantity === 0) {
      await pool.execute('DELETE FROM CartItems WHERE cart_item_id = ?', [cartItemId]);
      return res.json({ success: true });
    } else {
      await pool.execute('UPDATE CartItems SET quantity = ? WHERE cart_item_id = ?', [quantity, cartItemId]);
      const [r] = await pool.query('SELECT cart_item_id, product_id, quantity FROM CartItems WHERE cart_item_id = ?', [cartItemId]);
      return res.json(r[0]);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

router.delete('/cart/items/:cart_item_id', async (req, res) => {
  try {
    const consumerId = req.user.user_id;
    const cartItemId = req.params.cart_item_id;
    // ensure ownership
    const [rows] = await pool.query('SELECT ci.cart_item_id FROM CartItems ci JOIN Carts c ON ci.cart_id = c.cart_id WHERE ci.cart_item_id = ? AND c.consumer_id = ?', [cartItemId, consumerId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Cart item not found' });
    await pool.execute('DELETE FROM CartItems WHERE cart_item_id = ?', [cartItemId]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

/* ---------------------------
   Checkout: create Order from Cart
   - POST /cart/checkout { cart_id? }  (if cart_id not provided, use latest cart)
   - Transactional: checks stock, creates Orders and OrderItems and decrements Products.quantity
   --------------------------- */
router.post('/cart/checkout', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const consumerId = req.user.user_id;
    let cartId = req.body.cart_id;
    if (!cartId) {
      const [crows] = await conn.query('SELECT cart_id FROM Carts WHERE consumer_id = ? ORDER BY created_at DESC LIMIT 1', [consumerId]);
      if (crows.length === 0) {
        await conn.rollback();
        conn.release();
        return res.status(400).json({ error: 'No cart found' });
      }
      cartId = crows[0].cart_id;
    }

    // get cart items with product stock and unit price
    const [items] = await conn.query(`
      SELECT ci.cart_item_id, ci.product_id, ci.quantity AS qty, p.quantity AS stock, p.price
      FROM CartItems ci
      JOIN Products p ON ci.product_id = p.product_id
      WHERE ci.cart_id = ?
      FOR UPDATE
    `, [cartId]);

    if (items.length === 0) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ error: 'Cart is empty' });
    }

    // validate stock
    for (const it of items) {
      if (it.qty > it.stock) {
        await conn.rollback();
        conn.release();
        return res.status(400).json({ error: `Insufficient stock for product_id=${it.product_id}` });
      }
    }

    // compute total
    let total = 0;
    for (const it of items) total += parseFloat(it.price) * parseInt(it.qty);

    // create order
    const [or] = await conn.execute('INSERT INTO Orders (consumer_id, total_amount) VALUES (?, ?)', [consumerId, total]);
    const orderId = or.insertId;

    // insert order items & decrement stock
    for (const it of items) {
      await conn.execute('INSERT INTO OrderItems (order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)', [orderId, it.product_id, it.qty, it.price]);
      await conn.execute('UPDATE Products SET quantity = quantity - ? WHERE product_id = ?', [it.qty, it.product_id]);
    }

    // clear cart items (we'll delete the cart entirely)
    await conn.execute('DELETE FROM CartItems WHERE cart_id = ?', [cartId]);
    await conn.execute('DELETE FROM Carts WHERE cart_id = ?', [cartId]);

    await conn.commit();
    conn.release();
    res.json({ success: true, order_id: orderId, total_amount: total });
  } catch (err) {
    await conn.rollback().catch(() => {});
    conn.release();
    console.error(err);
    res.status(500).json({ error: 'DB error during checkout' });
  }
});

/* ---------------------------
   Consumer Order History
   - GET /orders  (list consumer's orders)
   - GET /orders/:orderId  (order details with items)
   --------------------------- */
router.get('/orders', async (req, res) => {
  try {
    const consumerId = req.user.user_id;
    const [rows] = await pool.query('SELECT order_id, order_date, total_amount FROM Orders WHERE consumer_id = ? ORDER BY order_date DESC', [consumerId]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

router.get('/orders/:orderId', async (req, res) => {
  try {
    const consumerId = req.user.user_id;
    const orderId = req.params.orderId;
    const [orders] = await pool.query('SELECT order_id, order_date, total_amount FROM Orders WHERE order_id = ? AND consumer_id = ?', [orderId, consumerId]);
    if (orders.length === 0) return res.status(404).json({ error: 'Order not found' });

    const [items] = await pool.query(`
      SELECT oi.order_item_id, oi.product_id, oi.quantity, oi.unit_price, p.name as product_name, p.producer_id
      FROM OrderItems oi
      JOIN Products p ON oi.product_id = p.product_id
      WHERE oi.order_id = ?
    `, [orderId]);

    res.json({ order: orders[0], items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

module.exports = router;
