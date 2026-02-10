import express from "express";
import { pool } from "../db.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", authMiddleware, async (req, res) => {
  const { rows } = await pool.query(
    "SELECT * FROM user_profiles WHERE user_id = $1",
    [req.user.id]
  );
  res.json(rows[0]);
});

router.post("/", authMiddleware, async (req, res) => {
  const { phone, address } = req.body;

  await pool.query(
    `INSERT INTO user_profiles
     (user_id, phone, address_line1, address_line2, city, state, pincode, country)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (user_id) DO UPDATE SET
     phone=$2, address_line1=$3, address_line2=$4, city=$5,
     state=$6, pincode=$7, country=$8`,
    [
      req.user.id,
      phone,
      address.line1,
      address.line2,
      address.city,
      address.state,
      address.pincode,
      address.country,
    ]
  );

  res.json({ message: "Profile saved" });
});

export default router;