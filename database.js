import sqlite3 from 'sqlite3';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbDir = join(__dirname, 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}
const dbPath = join(dbDir, 'keuangan.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Database connection error:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
  }
});

// Promisified DB helpers
export function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

export function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

export function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

export async function initDb() {
  // 1. Members table
  await run(`
    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      nim TEXT UNIQUE,
      is_locked INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Migration: Add columns to members if they do not exist
  const tableInfo = await all("PRAGMA table_info(members)");
  const hasNim = tableInfo.some(col => col.name === 'nim');
  if (!hasNim) {
    console.log("Migration: Adding 'nim' column to members table...");
    await run("ALTER TABLE members ADD COLUMN nim TEXT");
    
    // Backfill NIMs for existing members
    const existing = await all("SELECT id, name FROM members");
    let count = 1;
    for (const row of existing) {
      const generatedNim = `12050120${String(count).padStart(3, '0')}`;
      await run("UPDATE members SET nim = ? WHERE id = ?", [generatedNim, row.id]);
      count++;
    }
  }

  const hasIsLocked = tableInfo.some(col => col.name === 'is_locked');
  if (!hasIsLocked) {
    console.log("Migration: Adding 'is_locked' column to members table...");
    await run("ALTER TABLE members ADD COLUMN is_locked INTEGER DEFAULT 0");
  }

  // 2. Transactions ledger table
  await run(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      description TEXT,
      member_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE SET NULL
    )
  `);

  // 3. Uang Kas weekly dues payments tracker
  await run(`
    CREATE TABLE IF NOT EXISTS dues_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL,
      week_number INTEGER NOT NULL,
      amount REAL NOT NULL,
      payment_date TEXT NOT NULL,
      transaction_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
      FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE SET NULL,
      UNIQUE(member_id, week_number)
    )
  `);

  // Official student NIM list
  const actualStudentNims = {
    "NAILY DWI SAADAH": "25254311002",
    "ADE LIA PRATIWI": "25254311004",
    "BEVI SOFIANA": "25254311006",
    "DELA SAFITRI": "25254311008",
    "DIMAS KURNIA": "25254311010",
    "ISRAL YADI": "25254311012",
    "MUHAMMAD IMAM ABDULLAH": "25254311014",
    "RAHMAT HIDAYAT": "25254311016",
    "RYANTO": "25254311018",
    "SUKMA AYU RUDIARTI": "25254311020",
    "FAHRIL JORDY PRATAMA": "25254312022",
    "FITRI RAHMADANI": "25254312024",
    "KHONSA ROMADHONI": "25254312026",
    "REFHAN RAHMANDA PUTRA": "25254312028",
    "ZULFAH NOVRIZAL": "25254312032",
    "AIDIL ADI CANDRA": "25254312034",
    "HAMMI SOFIYA": "25254312036",
    "MINDA WIARSIH": "25254312038",
    "MUHAMMAD ZIKRI EDYANANDA": "25254312040",
    "RAFDI AHMAD": "25254312042",
    "SILVA AMANDA": "25254312044",
    "ABDULLAH AHMAD AZZAM": "25254313046",
    "BUNGA ZHELYCHA": "25254313048",
    "M. RADID DWIVA": "25254313050",
    "MUHAMMAD AL FADJRI": "25254313052",
    "OMAR THORIQ ZAHABY": "25254313054",
    "ZAKYATUL RAMADHAN": "25254313056",
    "RAJA ZHAFRAN": "25254313058"
  };

  // Automatically update existing member records with the correct NIMs from this list
  for (const [name, nim] of Object.entries(actualStudentNims)) {
    await run("UPDATE members SET nim = ? WHERE UPPER(TRIM(name)) = UPPER(?)", [nim, name]);
  }

  // Seed default classmates and some records if empty
  const count = await get("SELECT COUNT(*) as total FROM members");
  if (count.total === 0) {
    console.log("Seeding default classmates and test transactions...");
    const sampleMembers = Object.entries(actualStudentNims).map(([name, nim]) => ({ name, nim }));
    for (const m of sampleMembers) {
      await run("INSERT INTO members (name, nim) VALUES (?, ?)", [m.name, m.nim]);
    }

    const membersList = await all("SELECT id, name FROM members");
    const defaultDues = 5000;
    const today = new Date().toISOString().split('T')[0];

    // Seed some dues records
    for (const m of membersList) {
      if (m.name === "Aditya Pratama") {
        // Week 1
        let tx1 = await run("INSERT INTO transactions (type, category, amount, date, description, member_id) VALUES (?, ?, ?, ?, ?, ?)", 
          ['income', 'dues', defaultDues, today, `Uang Kas Week 1 - ${m.name}`, m.id]);
        await run("INSERT INTO dues_payments (member_id, week_number, amount, payment_date, transaction_id) VALUES (?, ?, ?, ?, ?)",
          [m.id, 1, defaultDues, today, tx1.id]);
        
        // Week 2
        let tx2 = await run("INSERT INTO transactions (type, category, amount, date, description, member_id) VALUES (?, ?, ?, ?, ?, ?)", 
          ['income', 'dues', defaultDues, today, `Uang Kas Week 2 - ${m.name}`, m.id]);
        await run("INSERT INTO dues_payments (member_id, week_number, amount, payment_date, transaction_id) VALUES (?, ?, ?, ?, ?)",
          [m.id, 2, defaultDues, today, tx2.id]);
      } else if (m.name === "Budi Santoso") {
        let tx = await run("INSERT INTO transactions (type, category, amount, date, description, member_id) VALUES (?, ?, ?, ?, ?, ?)", 
          ['income', 'dues', defaultDues, today, `Uang Kas Week 1 - ${m.name}`, m.id]);
        await run("INSERT INTO dues_payments (member_id, week_number, amount, payment_date, transaction_id) VALUES (?, ?, ?, ?, ?)",
          [m.id, 1, defaultDues, today, tx.id]);
      } else if (m.name === "Citra Lestari") {
        for (let w = 1; w <= 3; w++) {
          let tx = await run("INSERT INTO transactions (type, category, amount, date, description, member_id) VALUES (?, ?, ?, ?, ?, ?)", 
            ['income', 'dues', defaultDues, today, `Uang Kas Week ${w} - ${m.name}`, m.id]);
          await run("INSERT INTO dues_payments (member_id, week_number, amount, payment_date, transaction_id) VALUES (?, ?, ?, ?, ?)",
            [m.id, w, defaultDues, today, tx.id]);
        }
      }
    }

    // Seed general transactions (expenses/incomes)
    await run("INSERT INTO transactions (type, category, amount, date, description) VALUES (?, ?, ?, ?, ?)",
      ['expense', 'photocopies', 15000, today, 'Fotokopi modul kuliah TRK B']);
    await run("INSERT INTO transactions (type, category, amount, date, description) VALUES (?, ?, ?, ?, ?)",
      ['expense', 'social', 50000, today, 'Sumbangan teman sakit (rawat inap)']);
    await run("INSERT INTO transactions (type, category, amount, date, description) VALUES (?, ?, ?, ?, ?)",
      ['income', 'donation', 150000, today, 'Sisa dana kegiatan angkatan sebelumnya']);
    
    console.log("Database successfully seeded.");
  }
}

export default db;
