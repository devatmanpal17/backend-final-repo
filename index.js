const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const admin = require("firebase-admin");


// ================= FIREBASE =================
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  }),
});


// ================= DATABASE =================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});


// ================= APP =================
const app = express();

app.use(
  cors({
    origin: "https://donate-bridge-aau5.vercel.app",
    credentials: true,
  })
);

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

    if (!token) return res.status(400).send("No token");

    const decoded = await admin.auth().verifyIdToken(token);
    const { uid, name, email, picture } = decoded;

    const existing = await pool.query(
      "SELECT * FROM users WHERE firebase_uid=$1",
      [uid]
    );

    if (existing.rows.length === 0) {
      await pool.query(
        "INSERT INTO users (firebase_uid, name, email, picture) VALUES ($1,$2,$3,$4)",
        [uid, name, email, picture]
      );
      console.log("🆕 New user created");
    } else {
      console.log("👤 User exists");
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
    if (!token) return res.status(401).send("Unauthorized");

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


// ================= PORT =================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
