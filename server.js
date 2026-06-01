import express from 'express';
import cors from 'cors';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import * as db from './database.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json());

// Serve static frontend assets
app.use(express.static(join(__dirname, 'public')));

// Initialize database schema and seeds
await db.initDb();

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ThoriqKomtingB';

const requireAdmin = (req, res, next) => {
  const password = req.headers['x-admin-password'];
  if (password === ADMIN_PASSWORD) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized: Invalid admin password' });
  }
};

// Verify admin password
app.get('/api/admin/verify', requireAdmin, (req, res) => {
  res.json({ success: true });
});

// 1. Fetch dashboard summary statistics
app.get('/api/summary', async (req, res) => {
  try {
    const incomeRow = await db.get("SELECT SUM(amount) as total FROM transactions WHERE type = 'income'");
    const expenseRow = await db.get("SELECT SUM(amount) as total FROM transactions WHERE type = 'expense'");
    const duesCountRow = await db.get("SELECT COUNT(*) as total FROM dues_payments");

    const totalIncome = incomeRow.total || 0;
    const totalExpense = expenseRow.total || 0;
    const balance = totalIncome - totalExpense;

    res.json({
      totalIncome,
      totalExpense,
      balance,
      duesPaidCount: duesCountRow.total || 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Fetch classmate list with paid weeks tracker and aggregate contributions
app.get('/api/members', async (req, res) => {
  try {
    const members = await db.all("SELECT * FROM members ORDER BY name ASC");
    const payments = await db.all("SELECT * FROM dues_payments");

    const membersWithPayments = members.map(m => {
      const memberPayments = payments.filter(p => p.member_id === m.id);
      const paidWeeks = memberPayments.map(p => p.week_number);
      const totalDuesPaid = memberPayments.reduce((sum, p) => sum + p.amount, 0);
      return {
        ...m,
        paidWeeks,
        totalDuesPaid
      };
    });

    res.json(membersWithPayments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Add a new classmate
app.post('/api/members', requireAdmin, async (req, res) => {
  const { name, nim } = req.body;
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Name is required' });
  }
  if (!nim || nim.trim() === '') {
    return res.status(400).json({ error: 'NIM is required' });
  }
  try {
    // Manually verify NIM uniqueness for upgraded databases
    const existing = await db.get("SELECT name FROM members WHERE nim = ?", [nim.trim()]);
    if (existing) {
      return res.status(400).json({ error: `NIM sudah terdaftar atas nama "${existing.name}"` });
    }

    const result = await db.run("INSERT INTO members (name, nim, is_locked) VALUES (?, ?, 0)", [name.trim(), nim.trim()]);
    res.status(201).json({ id: result.id, name: name.trim(), nim: nim.trim(), is_locked: 0, paidWeeks: [], totalDuesPaid: 0 });
  } catch (error) {
    if (error.message.includes('UNIQUE')) {
      if (error.message.includes('nim')) {
        res.status(400).json({ error: 'NIM sudah terdaftar' });
      } else {
        res.status(400).json({ error: 'Nama siswa sudah terdaftar' });
      }
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// 4. Delete a classmate (with lock and dues protection)
app.delete('/api/members/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    // 1. Check if the student is locked
    const member = await db.get("SELECT is_locked, name FROM members WHERE id = ?", [id]);
    if (!member) {
      return res.status(404).json({ error: 'Siswa tidak ditemukan' });
    }
    if (member.is_locked === 1) {
      return res.status(400).json({ error: `Siswa "${member.name}" terkunci dan terproteksi dari penghapusan.` });
    }

    // 2. Check if the student has dues payments
    const payments = await db.get("SELECT COUNT(*) as count FROM dues_payments WHERE member_id = ?", [id]);
    if (payments.count > 0) {
      return res.status(400).json({ error: `Siswa "${member.name}" tidak dapat dihapus karena memiliki riwayat iuran aktif (${payments.count} setoran).` });
    }

    await db.run("DELETE FROM transactions WHERE member_id = ? AND category = 'dues'", [id]);
    await db.run("DELETE FROM members WHERE id = ?", [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4b. Toggle lock deletion status for student
app.post('/api/members/:id/toggle-lock', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { is_locked } = req.body;
  if (is_locked === undefined) {
    return res.status(400).json({ error: 'Field is_locked is required' });
  }
  try {
    await db.run("UPDATE members SET is_locked = ? WHERE id = ?", [is_locked ? 1 : 0, id]);
    res.json({ success: true, is_locked: is_locked ? 1 : 0 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4c. Student login route
app.post('/api/login/student', async (req, res) => {
  const { nim } = req.body;
  if (!nim || nim.trim() === '') {
    return res.status(400).json({ error: 'NIM harus diisi' });
  }
  try {
    const member = await db.get("SELECT id, name, nim FROM members WHERE nim = ?", [nim.trim()]);
    if (member) {
      res.json({ success: true, member });
    } else {
      res.status(404).json({ error: 'NIM tidak terdaftar di database kas kelas!' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Get transactions ledger list
app.get('/api/transactions', async (req, res) => {
  try {
    const transactions = await db.all(`
      SELECT t.*, m.name as member_name 
      FROM transactions t 
      LEFT JOIN members m ON t.member_id = m.id 
      ORDER BY t.date DESC, t.id DESC
    `);
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Record general transaction (e.g. donation, classroom expense)
app.post('/api/transactions', requireAdmin, async (req, res) => {
  try {
    const { type, category, amount, date, description, member_id } = req.body;

    // Insert transaksi seperti biasa
    const result = await db.run(
      `INSERT INTO transactions (type, category, amount, date, description, member_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [type, category, amount, date, description, member_id || null]
    );

    // ── Auto-input ke Uang Kas Tracker ──────────────────────────
    if (type === 'income' && category === 'dues' && member_id) {
      console.log('Auto-dues triggered:', { member_id, amount, date });

      const paidWeeks = await db.all(
        `SELECT week_number FROM dues_payments WHERE member_id = ?`,
        [member_id]
      );
      const paidNums = paidWeeks.map(r => r.week_number);
      console.log('Already paid weeks:', paidNums);

      const duesAmount = parseInt(process.env.DUES_AMOUNT) || 5000;
      const weeksToFill = Math.floor(amount / duesAmount);
      console.log('Weeks to fill:', weeksToFill);

      let filled = 0;
      for (let w = 1; w <= 16 && filled < weeksToFill; w++) {
        if (!paidNums.includes(w)) {
          try {
            await db.run(
              `INSERT OR IGNORE INTO dues_payments (member_id, week_number, amount, payment_date, transaction_id)
               VALUES (?, ?, ?, ?, ?)`,
              [member_id, w, duesAmount, date, result.id]
            );
            console.log(`Week ${w} filled for member ${member_id}`);
            filled++;
          } catch(insertErr) {
            console.error(`Failed insert week ${w}:`, insertErr.message);
          }
        }
      }
      console.log(`Total filled: ${filled}`);
    } else {
      console.log('Auto-dues skipped:', { type, category, member_id });
    }
    // ────────────────────────────────────────────────────────────

    res.json({ id: result.id, message: 'Transaction added successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Delete a transaction from the ledger
app.delete('/api/transactions/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    // Un-toggle dues if transaction was a dues payment
    await db.run("DELETE FROM dues_payments WHERE transaction_id = ?", [id]);
    await db.run("DELETE FROM transactions WHERE id = ?", [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 8. Toggle dues status (Uang Kas) for a week
app.post('/api/dues/toggle', requireAdmin, async (req, res) => {
  const { member_id, week_number, paid, amount } = req.body;
  if (member_id === undefined || week_number === undefined || paid === undefined) {
    return res.status(400).json({ error: 'Missing member_id, week_number, or paid status' });
  }

  try {
    const member = await db.get("SELECT name FROM members WHERE id = ?", [member_id]);
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    if (paid) {
      // If setting paid = true
      const existing = await db.get("SELECT id FROM dues_payments WHERE member_id = ? AND week_number = ?", [member_id, week_number]);
      if (existing) {
        return res.status(400).json({ error: 'Already paid for this week' });
      }

      const today = new Date().toISOString().split('T')[0];
      const duesAmount = parseFloat(amount) || 5000;

      // Create ledger income entry
      const txResult = await db.run(
        "INSERT INTO transactions (type, category, amount, date, description, member_id) VALUES (?, ?, ?, ?, ?, ?)",
        ['income', 'dues', duesAmount, today, `Uang Kas Week ${week_number} - ${member.name}`, member_id]
      );

      // Create due payment record linked to the ledger transaction
      await db.run(
        "INSERT INTO dues_payments (member_id, week_number, amount, payment_date, transaction_id) VALUES (?, ?, ?, ?, ?)",
        [member_id, week_number, duesAmount, today, txResult.id]
      );

      res.json({ success: true, status: 'paid' });
    } else {
      // If setting paid = false
      const payment = await db.get("SELECT transaction_id FROM dues_payments WHERE member_id = ? AND week_number = ?", [member_id, week_number]);
      if (!payment) {
        return res.status(400).json({ error: 'Payment record not found' });
      }

      // Delete the dues check status
      await db.run("DELETE FROM dues_payments WHERE member_id = ? AND week_number = ?", [member_id, week_number]);
      
      // Delete corresponding transaction in ledger
      if (payment.transaction_id) {
        await db.run("DELETE FROM transactions WHERE id = ?", [payment.transaction_id]);
      }

      res.json({ success: true, status: 'unpaid' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve frontend SPA fallback for browser routing
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
