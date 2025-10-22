// session_based_auth.js
import express from "express";
import session from "express-session";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import cors from "cors";
import mysql from "mysql2/promise";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import multer from "multer";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(session({
  secret: process.env.SESSION_SECRET || "dev-secret-change-me",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 8
  }
}));

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "musicdb",
  connectionLimit: 10
});

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: "Not authenticated" });
  next();
}

// uploads
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use("/uploads", express.static(uploadsDir));

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const safe = file.originalname.replace(/\s+/g, "_");
    cb(null, Date.now() + "-" + safe);
  }
});
const imageOnly = (req, file, cb) => {
  if (!file.mimetype.startsWith("image/")) return cb(new Error("Only image uploads allowed"));
  cb(null, true);
};
const upload = multer({ storage, fileFilter: imageOnly, limits: { fileSize: 5 * 1024 * 1024 } });

// auth
app.post("/signup", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: "username and password required" });

    const [rows] = await pool.query("SELECT id FROM users WHERE username = ?", [username]);
    if (rows.length > 0) return res.status(409).json({ error: "username already taken" });

    const password_hash = await bcrypt.hash(password, 12);
    const [ins] = await pool.query("INSERT INTO users (username, password_hash) VALUES (?, ?)", [username, password_hash]);
    req.session.userId = ins.insertId;
    req.session.username = username;
    res.json({ id: ins.insertId, username });
  } catch (e) {
    console.error("Signup error:", e);
    res.status(500).json({ error: "server error" });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: "username and password required" });

    const [rows] = await pool.query("SELECT id, password_hash FROM users WHERE username = ?", [username]);
    if (rows.length === 0) return res.status(401).json({ error: "invalid credentials" });

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "invalid credentials" });

    req.session.userId = user.id;
    req.session.username = username;
    res.json({ id: user.id, username });
  } catch (e) {
    console.error("Login error:", e);
    res.status(500).json({ error: "server error" });
  }
});

app.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/me", (req, res) => {
  if (!req.session.userId) return res.json(null);
  res.json({ id: req.session.userId, username: req.session.username });
});

app.post("/upload-image", requireAuth, upload.single("image"), (req, res) => {
  const url = `/uploads/${req.file.filename}`;
  res.json({ url });
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) return res.status(400).json({ error: err.message });
  else if (err && err.message === "Only image uploads allowed") return res.status(400).json({ error: err.message });
  return next(err);
});

// reviews
app.get("/artists/:artistId/reviews", async (req, res) => {
  try {
    const { artistId } = req.params;
    const [rows] = await pool.query(
      `SELECT r.*, u.username
       FROM reviews r
       JOIN users u ON u.id = r.user_id
       WHERE r.artist_id = ?
       ORDER BY r.created_at DESC`, [artistId]
    );
    res.json(rows);
  } catch (e) {
    console.error("List reviews error:", e);
    res.status(500).json({ error: "server error" });
  }
});

app.post("/reviews", requireAuth, async (req, res) => {
  try {
    const {
      artistId, artistName, artistDescription, artistPicture,
      albumTitle, trackTitle, trackLength, trackArtwork,
      reviewTitle, reviewDescription, starRating
    } = req.body || {};

    if (!artistId || !artistName || !trackTitle || !reviewTitle || !reviewDescription) {
      return res.status(400).json({ error: "missing required fields" });
    }

    const star = Math.max(1, Math.min(5, parseInt(starRating || "1", 10)));

    const [ins] = await pool.query(
      `INSERT INTO reviews
       (user_id, artist_id, artist_name, artist_description, artist_picture,
        album_title, track_title, track_length, track_artwork,
        review_title, review_description, star_rating)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.session.userId,
        artistId, artistName, artistDescription || "", artistPicture || "",
        albumTitle || "", trackTitle, trackLength || "", trackArtwork || "",
        reviewTitle, reviewDescription, star
      ]
    );

    const [rows] = await pool.query(
      `SELECT r.*, u.username FROM reviews r JOIN users u ON u.id = r.user_id WHERE r.id = ?`,
      [ins.insertId]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    console.error("Create review error:", e);
    res.status(500).json({ error: "server error" });
  }
});

app.delete("/reviews/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query("SELECT id, user_id FROM reviews WHERE id = ?", [id]);
    if (rows.length === 0) return res.status(404).json({ error: "not found" });
    if (rows[0].user_id !== req.session.userId) return res.status(403).json({ error: "forbidden" });

    await pool.query("DELETE FROM reviews WHERE id = ?", [id]);
    res.json({ ok: true });
  } catch (e) {
    console.error("Delete review error:", e);
    res.status(500).json({ error: "server error" });
  }
});

// static
app.use(express.static(__dirname));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server on http://localhost:${port}`));
