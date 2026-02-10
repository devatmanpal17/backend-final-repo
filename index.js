const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const admin = require("firebase-admin");

const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "postgres",
  password: "YOUR_PASSWORD",
  port: 5432,
});

const app = express();
app.use(cors());
app.use(express.json());


// ================= TEST =================
app.get("/", (req, res) => {
  res.send("Backend running 🚀");
});


// ================= AUTH =================
app.post("/auth/google", async (req, res) => {
  console.log("👉 /auth/google called");

  try {
    const { token } = req.body;

    if (!token) {
      console.log("❌ No token received");
      return res.status(400).send("No token");
    }

    console.log("✅ Token received");

    const decoded = await admin.auth().verifyIdToken(token);
    console.log("✅ Token verified");
    console.log("User:", decoded.email);

    const { uid, name, email, picture } = decoded;

    const existing = await pool.query(
      "SELECT * FROM users WHERE firebase_uid=$1",
      [uid]
    );

    if (existing.rows.length === 0) {
      console.log("🆕 Creating new user");
      await pool.query(
        "INSERT INTO users (firebase_uid, name, email, picture) VALUES ($1,$2,$3,$4)",
        [uid, name, email, picture]
      );
    } else {
      console.log("👤 User already exists");
    }

    res.send({ message: "Login success" });

  } catch (error) {
    console.log("🔥 AUTH ERROR:", error);
    res.status(401).send(error.message);
  }
});


// ================= AUTH MIDDLEWARE =================
const checkAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      console.log("❌ No token in header");
      return res.status(401).send("Unauthorized");
    }

    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    console.log("🔥 Middleware error:", error);
    res.status(401).send("Unauthorized");
  }
};


// ================= CREATE DONATION =================
app.post("/donations", checkAuth, async (req, res) => {
  try {
    const { items, quantity } = req.body;

    const result = await pool.query(
      "INSERT INTO donations (user_id, items, quantity, status) VALUES ($1,$2,$3,$4) RETURNING *",
      [req.user.uid, items, quantity || 1, "pending"]
    );

    res.send(result.rows[0]);
  } catch (error) {
    console.log("🔥 Donation error:", error);
    res.status(500).send(error.message);
  }
});


// ================= USER DONATIONS =================
app.get("/my-donations", checkAuth, async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM donations WHERE user_id=$1 ORDER BY id DESC",
    [req.user.uid]
  );

  res.send(result.rows);
});


// ================= ADMIN VIEW =================
app.get("/donations", async (req, res) => {
  const result = await pool.query("SELECT * FROM donations ORDER BY id DESC");
  res.send(result.rows);
});


const PORT = 3000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));