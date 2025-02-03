const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');
const { create } = require('domain');
process.env.TZ = 'Asia/Seoul';

const app = express();

// 미들웨어
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// DB 연결
let db;
async function initializeDB() {
    db = await open({
        filename: path.join(__dirname, 'database.db'),
        driver: sqlite3.Database
    });

    // 테이블 생성
    await db.exec(`
        CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            gender TEXT,
            phone TEXT,
            memo TEXT,
            created_at DATETIME DEFAULT (datetime('now', 'localtime'))
        );

        CREATE TABLE IF NOT EXISTS services (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            price INTEGER DEFAULT 0,
            is_favorite BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT (datetime('now', 'localtime'))
        );

        CREATE TABLE IF NOT EXISTS history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id INTEGER,
            service_id INTEGER,
            amount INTEGER,
            memo TEXT,
            created_at DATETIME,
            FOREIGN KEY (customer_id) REFERENCES customers(id),
            FOREIGN KEY (service_id) REFERENCES services(id)
        );
    `);
}

// 로그인 API
app.post('/api/login', (req, res) => {
    const { password } = req.body;
    if (password === '1234') {
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, message: '비밀번호가 일치하지 않습니다.' });
    }
});

// 고객 관련 API
app.get('/api/customers', async (req, res) => {
    try {
        const customers = await db.all('SELECT * FROM customers ORDER BY name');
        res.json(customers);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/customers', async (req, res) => {
    const { name, gender, phone, memo } = req.body;
    const koreanTime = getKoreanTime();

    try {
        const result = await db.run(
            'INSERT INTO customers (name, gender, phone, memo, created_at) VALUES (?, ?, ?, ?, ?)',
            [name, gender, phone, memo, koreanTime]
        );
        res.json({ id: result.lastID });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 시술 관련 API
app.get('/api/services', async (req, res) => {
    try {
        const services = await db.all(
            'SELECT * FROM services ORDER BY is_favorite DESC, name'
        );
        res.json(services);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/services', async (req, res) => {
    const { name, price } = req.body;
    const koreanTime = getKoreanTime();

    try {
        const result = await db.run(
            'INSERT INTO services (name, price, is_favorite, created_at) VALUES (?, ?, 0, ?)',
            [name, price, koreanTime]
        );
        res.json({ id: result.lastID });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/services/:id/favorite', async (req, res) => {
    const { id } = req.params;
    const { is_favorite } = req.body;
    try {
        await db.run(
            'UPDATE services SET is_favorite = ? WHERE id = ?',
            [is_favorite ? 1 : 0, id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 시술 히스토리 API
app.get('/api/history', async (req, res) => {
    const { customer_id, year, month, day } = req.query;
    try {
        let query = `
            SELECT 
                h.*,
                c.name as customer_name,
                c.gender,
                c.phone,
                s.name as service_name
            FROM history h
            JOIN customers c ON h.customer_id = c.id
            JOIN services s ON h.service_id = s.id
            WHERE 1=1
        `;
        
        const params = [];

        // customer_id가 있는 경우 (고객별 히스토리 조회 시)
        if (customer_id) {
            query += ' AND h.customer_id = ?';
            params.push(customer_id);
        } 
        // 메인화면 조회 시 (날짜 필터)
        else {
            if (year) {
                query += " AND strftime('%Y', h.created_at) = ?";
                params.push(year);
            }
            if (month) {
                query += " AND strftime('%m', h.created_at) = ?";
                params.push(month);
            }
            if (day) {
                query += " AND strftime('%d', h.created_at) = ?";
                params.push(day);
            }
        }
        
        query += ' ORDER BY h.created_at DESC';
        
        const history = await db.all(query, params);
        res.json(history);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/history', async (req, res) => {
    const { customer_id, service_id, amount, memo, created_at } = req.body;
    const koreanTime = getKoreanTime();

    try {
        const result = await db.run(
            'INSERT INTO history (customer_id, service_id, amount, memo, created_at) VALUES (?, ?, ?, ?, ?)',
            [customer_id, service_id, amount, memo, created_at]
        );
        res.json({ id: result.lastID });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 시술 내역 수정 API
app.put('/api/history/:id', async (req, res) => {
    const { id } = req.params;
    const { service_id, amount, memo, created_at } = req.body;
    try {
        await db.run(
            'UPDATE history SET service_id = ?, amount = ?, memo = ?, created_at = ? WHERE id = ?',
            [service_id, amount, memo, created_at, id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 고객 정보 수정 API
app.put('/api/customers/:id', async (req, res) => {
    const { id } = req.params;
    const { name, gender, phone, memo } = req.body;
    try {
        await db.run(
            'UPDATE customers SET name = ?, gender = ?, phone = ?, memo = ? WHERE id = ?',
            [name, gender, phone, memo, id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 시술 내역 삭제 API
app.delete('/api/history/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await db.run('DELETE FROM history WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 고객 정보 삭제 API (관련 시술 내역도 함께 삭제)
app.delete('/api/customers/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await db.run('BEGIN TRANSACTION');
        await db.run('DELETE FROM history WHERE customer_id = ?', [id]);
        await db.run('DELETE FROM customers WHERE id = ?', [id]);
        await db.run('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await db.run('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

// 시술 정보 수정 API
app.put('/api/services/:id', async (req, res) => {
    const { id } = req.params;
    const { name, price } = req.body;
    try {
        await db.run(
            'UPDATE services SET name = ?, price = ? WHERE id = ?',
            [name, price, id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/sales', async (req, res) => {
    const { viewType, startDate, endDate } = req.query;
    try {
        let groupFormat;
        switch(viewType) {
            case 'year':
                groupFormat = '%Y년';
                break;
            case 'month':
                groupFormat = '%Y년 %m월';
                break;
            default:
                groupFormat = '%Y-%m-%d';
        }

        const query = `
            SELECT 
                strftime('${groupFormat}', created_at) as period,
                COUNT(*) as count,
                SUM(amount) as total
            FROM history
            WHERE date(created_at) BETWEEN date(?) AND date(?)
            GROUP BY strftime('${groupFormat}', created_at)
            ORDER BY created_at
        `;

        const results = await db.all(query, [startDate, endDate]);
        res.json(results);
    } catch (err) {
        console.error('Sales query error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 서버 시작
async function startServer() {
    await initializeDB();
    const PORT = 3000;
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
}

// 시간 포맷팅 함수 수정
function getKoreanTime() {
    const now = new Date();
    now.setHours(now.getHours() + 9); // UTC+9 (한국 시간)
    return now.toISOString().slice(0, 19).replace('T', ' ');
}

startServer().catch(console.error);