// server.js
require('dotenv').config();
const express = require('express');
const app = express();
const cors = require("cors");

// import DB pool
const db = require('./db');

// Middleware to parse JSON
app.use(express.json());
app.use(cors());

// Routes
const userRoutes = require('./routes/users');
app.use('/tcf', userRoutes);

// Test DB connection before starting server
(async () => {
  try {
    // Run a simple query to check DB connectivity
    await db.query('SELECT 1');
    console.log('✅ Connected to MySQL database');

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  } catch (err) {
    console.error('❌ Unable to connect to MySQL:', err.message);
    process.exit(1); // stop the app if DB fails
  }
})();

// Optional: catch all unmatched routes (nice for debugging)
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} not found` });
});