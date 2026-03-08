import express from "express";
import { createServer as createViteServer } from "vite";
import { Server } from "socket.io";
import http from "http";
import Database from "better-sqlite3";
import cron from "node-cron";
import path from "path";

const db = new Database("sa3rak.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    category_id INTEGER,
    usd_price REAL NOT NULL,
    image_url TEXT,
    FOREIGN KEY (category_id) REFERENCES categories(id)
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER,
    customer_name TEXT NOT NULL,
    address TEXT NOT NULL,
    phone TEXT NOT NULL,
    items TEXT NOT NULL,
    total_syp REAL NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  );

  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

// Seed initial rate if not exists
const checkRate = db.prepare("SELECT value FROM settings WHERE key = 'usd_to_syp'").get();
if (!checkRate) {
  db.prepare("INSERT INTO settings (key, value) VALUES ('usd_to_syp', '15000')").run();
}

const checkPass = db.prepare("SELECT value FROM settings WHERE key = 'merchant_password'").get();
if (!checkPass) {
  db.prepare("INSERT INTO settings (key, value) VALUES ('merchant_password', 'admin')").run();
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server);
  const PORT = 3000;

  app.use(express.json({ limit: '5mb' }));

  // Exchange Rate Management: Merchant updates this manually via the dashboard
  app.get("/api/rate", (req, res) => {
    const rate = db.prepare("SELECT value FROM settings WHERE key = 'usd_to_syp'").get();
    res.json({ rate: parseFloat(rate.value) });
  });

  app.post("/api/rate", (req, res) => {
    const { rate } = req.body;
    if (!rate || isNaN(parseFloat(rate))) {
      return res.status(400).json({ error: "Invalid rate" });
    }
    db.prepare("UPDATE settings SET value = ? WHERE key = 'usd_to_syp'").run(rate.toString());
    io.emit("rate_updated", { rate: parseFloat(rate) });
    res.json({ success: true, rate: parseFloat(rate) });
  });

  app.post("/api/auth/login", (req, res) => {
    const { username, password } = req.body;
    const storedPass = db.prepare("SELECT value FROM settings WHERE key = 'merchant_password'").get();
    if (username === 'admin' && password === storedPass.value) {
      res.json({ success: true, role: 'merchant', username: 'admin' });
    } else {
      // Check if it's a customer
      const customer = db.prepare("SELECT * FROM customers WHERE username = ? AND password = ?").get(username, password);
      if (customer) {
        res.json({ 
          success: true, 
          id: customer.id, 
          username: customer.username, 
          role: 'customer' 
        });
      } else {
        res.status(401).json({ success: false, error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
      }
    }
  });

  app.post("/api/auth/register", (req, res) => {
    const { username, password } = req.body;
    try {
      const result = db.prepare("INSERT INTO customers (username, password) VALUES (?, ?)").run(username, password);
      res.json({ 
        success: true, 
        id: result.lastInsertRowid, 
        username, 
        role: 'customer' 
      });
    } catch (error: any) {
      if (error.message.includes("UNIQUE constraint failed")) {
        res.status(400).json({ success: false, error: "اسم المستخدم موجود مسبقاً" });
      } else {
        res.status(500).json({ success: false, error: "حدث خطأ أثناء التسجيل" });
      }
    }
  });

  app.post("/api/auth/change-password", (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const storedPass = db.prepare("SELECT value FROM settings WHERE key = 'merchant_password'").get();
    if (oldPassword === storedPass.value) {
      db.prepare("UPDATE settings SET value = ? WHERE key = 'merchant_password'").run(newPassword);
      res.json({ success: true });
    } else {
      res.status(401).json({ success: false, error: "كلمة المرور القديمة غير صحيحة" });
    }
  });

  app.get("/api/categories", (req, res) => {
    const categories = db.prepare("SELECT * FROM categories").all();
    res.json(categories);
  });

  app.post("/api/categories", (req, res) => {
    const { name } = req.body;
    const result = db.prepare("INSERT INTO categories (name) VALUES (?)").run(name);
    res.json({ id: result.lastInsertRowid, name });
  });

  app.get("/api/products", (req, res) => {
    const products = db.prepare(`
      SELECT p.*, c.name as category_name 
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.id
    `).all();
    res.json(products);
  });

  app.post("/api/products", (req, res) => {
    const { name, description, category_id, usd_price, image_url } = req.body;
    const result = db.prepare(`
      INSERT INTO products (name, description, category_id, usd_price, image_url) 
      VALUES (?, ?, ?, ?, ?)
    `).run(name, description, category_id, usd_price, image_url);
    res.json({ id: result.lastInsertRowid });
  });

  app.put("/api/products/:id", (req, res) => {
    const { name, description, category_id, usd_price, image_url } = req.body;
    db.prepare(`
      UPDATE products 
      SET name = ?, description = ?, category_id = ?, usd_price = ?, image_url = ?
      WHERE id = ?
    `).run(name, description, category_id, usd_price, image_url, req.params.id);
    res.json({ success: true });
  });

  app.delete("/api/products/:id", (req, res) => {
    db.prepare("DELETE FROM products WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/orders", (req, res) => {
    const orders = db.prepare("SELECT * FROM orders ORDER BY created_at DESC").all();
    res.json(orders);
  });

  app.post("/api/orders", (req, res) => {
    const { customer_id, customer_name, address, phone, items, total_syp } = req.body;
    const result = db.prepare(`
      INSERT INTO orders (customer_id, customer_name, address, phone, items, total_syp) 
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(customer_id || null, customer_name, address, phone, JSON.stringify(items), total_syp);
    
    const newOrder = {
      id: result.lastInsertRowid,
      customer_id,
      customer_name,
      address,
      phone,
      items,
      total_syp,
      status: 'pending',
      created_at: new Date().toISOString()
    };
    
    io.emit("new_order", newOrder);
    res.json(newOrder);
  });

  app.get("/api/customer/orders/:username", (req, res) => {
    const orders = db.prepare(`
      SELECT o.* FROM orders o
      JOIN customers c ON o.customer_id = c.id
      WHERE c.username = ?
      ORDER BY o.created_at DESC
    `).all(req.params.username);
    res.json(orders);
  });

  app.patch("/api/orders/:id/status", (req, res) => {
    const { status } = req.body;
    db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(status, req.params.id);
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
