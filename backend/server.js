require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');
const { create } = require('domain');
process.env.TZ = 'Asia/Seoul';
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

        CREATE TABLE IF NOT EXISTS backup_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            is_auto_backup BOOLEAN DEFAULT 0,
            backup_interval TEXT DEFAULT 'weekly',
            backup_time TEXT DEFAULT '03:00',
            backup_day TEXT DEFAULT 'sunday',
            backup_email TEXT,
            created_at DATETIME DEFAULT (datetime('now', 'localtime')),
            updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
        );
    `);
}

// 백업 설정 테이블만 따로 생성하는 함수
async function createBackupSettingsTable() {
    try {
        await db.exec(`
            CREATE TABLE IF NOT EXISTS backup_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                is_auto_backup BOOLEAN DEFAULT 0,
                backup_interval TEXT DEFAULT 'weekly',
                backup_time TEXT DEFAULT '03:00',
                backup_day TEXT DEFAULT 'sunday',
                backup_email TEXT,
                created_at DATETIME DEFAULT (datetime('now', 'localtime')),
                updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
            );
        `);
        console.log('백업 설정 테이블 생성 완료');
    } catch (error) {
        console.error('백업 설정 테이블 생성 실패:', error);
    }
}

// 로그인 API
app.post('/api/login', (req, res) => {
    const { password } = req.body;
    if (password === '7878' || password === 'admin') {
        res.json({ 
            success: true, 
            isAdmin: password === 'admin'  // 관리자 여부 전달
        });
    } else {
        res.status(401).json({ success: false, message: '비밀번호가 일치하지 않습니다.' });
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
                groupFormat = '%Y-%m-%d'; // 일별은 기본 날짜 형식으로 반환
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
            JOIN services s ON h.service_id = s.id
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
                {id: 'created_at', title: '날짜'},
                {id: 'customer_name', title: '고객명'},
                {id: 'service_name', title: '시술명'},
                {id: 'amount', title: '금액'},
                {id: 'memo', title: '메모'}
            ]
        });

        // ZIP 파일 생성
        const zip = new require('jszip')();
        
        zip.file('customers.csv', customersStringifier.getHeaderString() + 
                                customersStringifier.stringifyRecords(customers));
        zip.file('services.csv', servicesStringifier.getHeaderString() + 
                               servicesStringifier.stringifyRecords(services));
        zip.file('history.csv', historyStringifier.getHeaderString() + 
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
        let settings = await db.get('SELECT * FROM backup_settings ORDER BY id DESC LIMIT 1');
        if (!settings) {
            // 기본 설정 생성
            await db.run(`
                INSERT INTO backup_settings 
                (is_auto_backup, backup_interval, backup_time, backup_day, backup_email) 
                VALUES (0, 'weekly', '03:00', 'sunday', NULL)
            `);
            settings = await db.get('SELECT * FROM backup_settings ORDER BY id DESC LIMIT 1');
        }
        res.json(settings);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 백업 설정 업데이트 API
app.put('/api/backup/settings', async (req, res) => {
    const { is_auto_backup, backup_interval, backup_time, backup_day, backup_email } = req.body;
    try {
        await db.run(`
            UPDATE backup_settings 
            SET is_auto_backup = ?, 
                backup_interval = ?, 
                backup_time = ?, 
                backup_day = ?, 
                backup_email = ?,
                updated_at = datetime('now', 'localtime')
            WHERE id = (SELECT id FROM backup_settings ORDER BY id DESC LIMIT 1)
        `, [is_auto_backup, backup_interval, backup_time, backup_day, backup_email]);
        
        // 백업 스케줄 재설정
        updateBackupSchedule({
            is_auto_backup,
            backup_interval,
            backup_time,
            backup_day,
            backup_email
        });
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 수동 백업 실행 API
app.post('/api/backup/run', async (req, res) => {
    try {
        const settings = await db.get('SELECT * FROM backup_settings ORDER BY id DESC LIMIT 1');
        if (!settings?.backup_email) {
            return res.status(400).json({ error: '백업 이메일 설정이 필요합니다.' });
        }
        
        await runBackupNow(settings.backup_email);
        res.json({ success: true, message: '백업이 시작되었습니다.' });
    } catch (err) {
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

startServer().catch(console.error);