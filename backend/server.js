require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');
const crypto = require('crypto');
const { create } = require('domain');
process.env.TZ = 'Asia/Seoul';

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const createCsvStringifier = require('csv-writer').createObjectCsvStringifier;
const { updateBackupSchedule, runBackupNow } = require(path.join(__dirname, 'emailBackup.js'));

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

    // 모든 테이블 생성을 여기서 진행
    await db.exec(`
        CREATE TABLE IF NOT EXISTS customers (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            gender TEXT,
            phone TEXT,
            memo TEXT,
            delete_yn TEXT DEFAULT 'N',
            created_at DATETIME DEFAULT (datetime('now', 'localtime')),
            updated_at DATETIME
        );

        CREATE TABLE IF NOT EXISTS services (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            price INTEGER DEFAULT 0,
            is_favorite BOOLEAN DEFAULT 0,
            is_deleted TEXT DEFAULT 'N',
            created_at DATETIME DEFAULT (datetime('now', 'localtime')),
            updated_at DATETIME
        );

        CREATE TABLE IF NOT EXISTS history (
            id TEXT PRIMARY KEY,
            customer_id TEXT,
            service_id TEXT,
            amount INTEGER,
            memo TEXT,
            created_at DATETIME DEFAULT (datetime('now', 'localtime')),
            treatment_at DATETIME,
            is_direct_input BOOLEAN DEFAULT 0,
            modified_service_name TEXT,
            updated_at DATETIME,
            delete_yn TEXT DEFAULT 'N',
            FOREIGN KEY (customer_id) REFERENCES customers(id),
            FOREIGN KEY (service_id) REFERENCES services(id)
        );

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        );
    `);

    // 기본 settings 값 초기화 (이미 존재하면 건너뜀)
    const initSettings = [
        ['user_password_hash', sha256('7878')],
        ['admin_password_hash', sha256('admin')],
        ['is_auto_backup', '0'],
        ['backup_interval', 'weekly'],
        ['backup_time', '03:00'],
        ['backup_day', 'sunday'],
        ['backup_email', ''],
    ];
    for (const [key, value] of initSettings) {
        await db.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', [key, value]);
    }

    // 기존 DB에 컬럼 추가 (이미 있으면 무시)
    try { await db.run('ALTER TABLE customers ADD COLUMN updated_at DATETIME'); } catch {}
    try { await db.run('ALTER TABLE services ADD COLUMN updated_at DATETIME'); } catch {}
    try { await db.run('ALTER TABLE history ADD COLUMN updated_at DATETIME'); } catch {}
    try { await db.run('ALTER TABLE history ADD COLUMN treatment_at DATETIME'); } catch {}
    try { await db.run('ALTER TABLE history ADD COLUMN delete_yn TEXT DEFAULT \'N\''); } catch {}
    try { await db.run('ALTER TABLE customers ADD COLUMN delete_yn TEXT DEFAULT \'N\''); } catch {}
}

// 로그인 API
app.post('/api/login', async (req, res) => {
    const { password } = req.body;
    const hash = sha256(password || '');
    try {
        const [userRow, adminRow] = await Promise.all([
            db.get("SELECT value FROM settings WHERE key = 'user_password_hash'"),
            db.get("SELECT value FROM settings WHERE key = 'admin_password_hash'"),
        ]);
        if (hash === adminRow?.value) {
            return res.json({ success: true, isAdmin: true });
        }
        if (hash === userRow?.value) {
            return res.json({ success: true, isAdmin: false });
        }
        res.status(401).json({ success: false, message: '비밀번호가 일치하지 않습니다.' });
    } catch (err) {
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
});

// 데이터베이스 다운로드 API 추가
app.get('/api/database/download', (req, res) => {
    const dbPath = path.join(__dirname, 'database.db');
    res.download(dbPath);
});

// 고객 관련 API
app.get('/api/customers', async (req, res) => {
    try {
        const customers = await db.all("SELECT * FROM customers WHERE delete_yn != 'Y' ORDER BY name");
        res.json(customers);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/customers', async (req, res) => {
    const { name, gender, phone, memo } = req.body;
    try {
        const last = await db.get("SELECT id FROM customers ORDER BY id DESC LIMIT 1");
        const nextNum = last ? parseInt(last.id.slice(1)) + 1 : 1;
        const newId = 'C' + String(nextNum).padStart(8, '0');
        await db.run(
            'INSERT INTO customers (id, name, gender, phone, memo) VALUES (?, ?, ?, ?, ?)',
            [newId, name, gender, phone || '', memo || '']
        );
        res.json({ id: newId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 시술 관련 API
app.get('/api/services', async (req, res) => {
    try {
        const services = await db.all(
            "SELECT * FROM services WHERE is_deleted = 'N' ORDER BY is_favorite DESC, name"
        );
        res.json(services);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/services', async (req, res) => {
    const { name, price } = req.body;
    try {
        const last = await db.get("SELECT id FROM services ORDER BY id DESC LIMIT 1");
        const nextNum = last ? parseInt(last.id.slice(1)) + 1 : 1;
        const newId = 'S' + String(nextNum).padStart(6, '0');
        await db.run(
            'INSERT INTO services (id, name, price, is_favorite) VALUES (?, ?, ?, 0)',
            [newId, name, price]
        );
        res.json({ id: newId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/services/:id/favorite', async (req, res) => {
    const { id } = req.params;
    const { is_favorite } = req.body;
    try {
        await db.run(
            "UPDATE services SET is_favorite = ?, updated_at = datetime('now', 'localtime') WHERE id = ?",
            [is_favorite ? 1 : 0, id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 시술 히스토리 API
app.get('/api/history', async (req, res) => {
    const { customer_id, year, month, day, startDate, endDate, term, gender } = req.query;
    try {
        let query = `
            SELECT
                h.*,
                c.name as customer_name,
                c.gender,
                c.phone,
                CASE
                    WHEN h.is_direct_input = 1 THEN h.modified_service_name
                    ELSE s.name
                END as service_name
            FROM history h
            JOIN customers c ON h.customer_id = c.id
            LEFT JOIN services s ON h.service_id = s.id
            WHERE h.delete_yn != 'Y'
        `;

        const params = [];

        if (customer_id) {
            query += ' AND h.customer_id = ?';
            params.push(customer_id);
        } else {
            if (startDate) { query += " AND date(h.treatment_at) >= ?"; params.push(startDate); }
            if (endDate)   { query += " AND date(h.treatment_at) <= ?"; params.push(endDate); }
            if (year)  { query += " AND strftime('%Y', h.treatment_at) = ?"; params.push(year); }
            if (month) { query += " AND strftime('%m', h.treatment_at) = ?"; params.push(month); }
            if (day)   { query += " AND strftime('%d', h.treatment_at) = ?"; params.push(day); }
        }

        if (term) {
            const t = `%${term}%`;
            query += ' AND (c.name LIKE ? OR s.name LIKE ? OR h.modified_service_name LIKE ? OR h.memo LIKE ? OR c.phone LIKE ?)';
            params.push(t, t, t, t, t);
        }
        if (gender) {
            query += ' AND c.gender = ?';
            params.push(gender);
        }

        query += ' ORDER BY h.treatment_at DESC';
        
        const history = await db.all(query, params);
        res.json(history);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/history', async (req, res) => {
    let { customer_id, service_id, amount, memo, treatment_at, modified_service_name } = req.body;
    const is_direct_input = service_id == null || service_id == "";
    service_id = is_direct_input ? null : service_id;

    try {
        const ymd = treatment_at
            ? treatment_at.slice(0, 10).replace(/-/g, '')
            : new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const lastOfDay = await db.get(
            "SELECT id FROM history WHERE id LIKE ? ORDER BY id DESC LIMIT 1",
            ['H' + ymd + '%']
        );
        const seq = lastOfDay ? parseInt(lastOfDay.id.slice(9)) + 1 : 1;
        const newId = 'H' + ymd + String(seq).padStart(5, '0');

        await db.run(
            `INSERT INTO history (
                id, customer_id, service_id, amount, memo, treatment_at,
                is_direct_input, modified_service_name, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))`,
            [newId, customer_id, service_id, amount, memo, treatment_at,
             is_direct_input ? 1 : 0, modified_service_name]
        );
        res.json({ id: newId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 시술 내역 수정 API
app.put('/api/history/:id', async (req, res) => {
    const { id } = req.params;
    let { service_id, amount, memo, treatment_at, modified_service_name } = req.body;
    const is_direct_input = service_id == null || service_id == "";
    service_id = is_direct_input ? null : service_id;

    try {
        await db.run(
            `UPDATE history SET
                service_id = ?, amount = ?, memo = ?, treatment_at = ?,
                is_direct_input = ?, modified_service_name = ?,
                updated_at = datetime('now', 'localtime')
            WHERE id = ?`,
            [service_id, amount, memo, treatment_at,
             is_direct_input ? 1 : 0, modified_service_name, id]
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
            "UPDATE customers SET name = ?, gender = ?, phone = ?, memo = ?, updated_at = datetime('now', 'localtime') WHERE id = ?",
            [name, gender, phone, memo, id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 시술 내역 삭제 API (논리 삭제)
app.delete('/api/history/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await db.run("UPDATE history SET delete_yn = 'Y', updated_at = datetime('now', 'localtime') WHERE id = ?", [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 고객 정보 삭제 API (논리 삭제, 시술 이력 유지)
app.delete('/api/customers/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await db.run("UPDATE customers SET delete_yn = 'Y', updated_at = datetime('now', 'localtime') WHERE id = ?", [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 시술 정보 수정 API
app.put('/api/services/:id', async (req, res) => {
    const { id } = req.params;
    const { name, price } = req.body;
    try {
        await db.run(
            "UPDATE services SET name = ?, price = ?, updated_at = datetime('now', 'localtime') WHERE id = ?",
            [name, price, id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 시술 항목 삭제 API (논리 삭제)
app.delete('/api/services/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await db.run(
            "UPDATE services SET is_deleted = 'Y', updated_at = datetime('now', 'localtime') WHERE id = ?",
            [id]
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
                groupFormat = '%Y';
                break;
            case 'month':
                groupFormat = '%Y-%m';
                break;
            default:
                groupFormat = '%Y-%m-%d'; // 일별은 기본 날짜 형식으로 반환
        }

        const query = `
            SELECT
                strftime('${groupFormat}', treatment_at) as period,
                COUNT(*) as count,
                SUM(amount) as total
            FROM history
            WHERE delete_yn != 'Y'
            AND date(treatment_at) BETWEEN date(?) AND date(?)
            GROUP BY strftime('${groupFormat}', treatment_at)
            ORDER BY treatment_at
        `;

        const results = await db.all(query, [startDate, endDate]);
        res.json(results);
    } catch (err) {
        console.error('Sales query error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/export/csv', async (req, res) => {
    try {
        // 모든 데이터 조회
        const customers = await db.all('SELECT * FROM customers ORDER BY id');
        const services = await db.all('SELECT * FROM services ORDER BY id');
        const history = await db.all(`
            SELECT 
                h.*,
                c.name as customer_name,
                s.name as service_name
            FROM history h
            JOIN customers c ON h.customer_id = c.id
            LEFT JOIN services s ON h.service_id = s.id
            ORDER BY h.id
        `);

        // 각 테이블별 CSV 생성
        const customersStringifier = createCsvStringifier({
            header: [
                {id: 'id', title: 'ID'},
                {id: 'name', title: '이름'},
                {id: 'gender', title: '성별'},
                {id: 'phone', title: '전화번호'},
                {id: 'memo', title: '메모'},
                {id: 'created_at', title: '등록일'}
            ]
        });

        const servicesStringifier = createCsvStringifier({
            header: [
                {id: 'id', title: 'ID'},
                {id: 'name', title: '시술명'},
                {id: 'price', title: '금액'},
                {id: 'is_favorite', title: '즐겨찾기'},
                {id: 'created_at', title: '등록일'}
            ]
        });

        const historyStringifier = createCsvStringifier({
            header: [
                {id: 'id', title: 'ID'},
                {id: 'treatment_at', title: '날짜'},
                {id: 'customer_name', title: '고객명'},
                {id: 'service_name', title: '시술명'},
                {id: 'is_direct_input', title: '직접입력여부'},
                {id: 'modified_service_name', title: '직접입력시술명'},
                {id: 'amount', title: '금액'},
                {id: 'memo', title: '메모'}
            ]
        });

        // ZIP 파일 생성
        const zip = new require('jszip')();
        
        zip.file('customers.csv', '\ufeff' + customersStringifier.getHeaderString() +
                                customersStringifier.stringifyRecords(customers));
        zip.file('services.csv', '\ufeff' + servicesStringifier.getHeaderString() +
                               servicesStringifier.stringifyRecords(services));
        zip.file('history.csv', '\ufeff' + historyStringifier.getHeaderString() +
                              historyStringifier.stringifyRecords(history));

        const zipContent = await zip.generateAsync({type: 'nodebuffer'});

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', 'attachment; filename=data.zip');
        res.send(zipContent);

    } catch (err) {
        console.error('Export error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 시간 포맷팅 함수 수정
function getKoreanTime() {
    const now = new Date();
    now.setHours(now.getHours() + 9); // UTC+9 (한국 시간)
    return now.toISOString().slice(0, 19).replace('T', ' ');
}

// 백업 설정 조회 API
app.get('/api/backup/settings', async (req, res) => {
    try {
        const keys = ['is_auto_backup', 'backup_interval', 'backup_time', 'backup_day', 'backup_email'];
        const rows = await db.all(`SELECT key, value FROM settings WHERE key IN (${keys.map(() => '?').join(',')})`, keys);
        const settings = {};
        for (const r of rows) settings[r.key] = r.value;
        res.json(settings);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 백업 설정 업데이트 API
app.put('/api/backup/settings', async (req, res) => {
    const { is_auto_backup, backup_interval, backup_time, backup_day, backup_email } = req.body;
    try {
        const updates = [
            ['is_auto_backup', String(is_auto_backup ?? '0')],
            ['backup_interval', backup_interval || 'weekly'],
            ['backup_time', backup_time || '03:00'],
            ['backup_day', backup_day || 'sunday'],
            ['backup_email', backup_email || ''],
        ];
        for (const [key, value] of updates) {
            await db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 수동 백업 실행 API
app.post('/api/backup/run', async (req, res) => {
    try {
        const emailRow = await db.get("SELECT value FROM settings WHERE key = 'backup_email'");
        if (!emailRow?.value) {
            return res.status(400).json({ error: '백업 이메일 설정이 필요합니다.' });
        }
        await runBackupNow(emailRow.value);
        res.json({ success: true, message: '백업이 시작되었습니다.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 서버 시작
async function startServer() {
    await initializeDB();
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
}

app.post('/api/admin/execute-sql', async (req, res) => {
    const { query } = req.body;
    try {
        // 유효한 구문만 추출 (빈 줄, 주석 제거 후 ; 기준 분리)
        const statements = query
            .split(';')
            .map(s => s.replace(/--[^\n]*/g, '').trim())
            .filter(s => s.length > 0);

        if (statements.length === 0) {
            return res.json({ success: true, isSelect: false, changes: 0 });
        }

        // 단일 SELECT / PRAGMA 구문
        if (statements.length === 1) {
            const trimmed = statements[0].toLowerCase();
            const isSelect = trimmed.startsWith('select') || trimmed.startsWith('pragma');
            if (isSelect) {
                const results = await db.all(statements[0]);
                return res.json({ success: true, isSelect: true, results });
            }
            const result = await db.run(statements[0]);
            return res.json({ success: true, isSelect: false, changes: result.changes ?? 0 });
        }

        // 다중 구문: exec으로 일괄 실행 (결과 반환 없음)
        await db.exec(statements.join(';'));
        res.json({ success: true, isSelect: false, message: `${statements.length}개 구문 실행 완료` });
    } catch (err) {
        console.error('SQL 실행 에러:', err);
        res.status(500).json({ error: err.message });
    }
});

startServer().catch(console.error);