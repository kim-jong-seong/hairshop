// emailBackup.js
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

let currentCronJob = null;

// 네이버 메일 SMTP 설정
const transporter = nodemailer.createTransport({
    host: 'smtp.naver.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

// 백업 이메일 전송 함수
async function sendBackupEmail(toEmail) {
    const dbPath = path.join(__dirname, 'database.db');
    
    try {
        const mailOptions = {
            from: process.env.SMTP_USER,
            to: toEmail,
            subject: `헤어샵 DB 백업 - ${new Date().toISOString().split('T')[0]}`,
            text: '자동 백업 데이터베이스 파일이 첨부되어 있습니다.',
            attachments: [{
                filename: `hairshop_database_backup_${new Date().toISOString().split('T')[0]}.db`,
                content: fs.createReadStream(dbPath)
            }]
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('백업 이메일 전송 성공:', info.messageId);
        return true;
    } catch (error) {
        console.error('백업 이메일 전송 실패:', error);
        throw error;
    }
}

// 크론 표현식 생성 함수
function generateCronExpression(time, interval, day) {
    const [hours, minutes] = time.split(':');
    
    switch (interval) {
        case 'daily':
            return `${minutes} ${hours} * * *`;
        case 'weekly':
            const days = {
                sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
                thursday: 4, friday: 5, saturday: 6
            };
            return `${minutes} ${hours} * * ${days[day]}`;
        case 'monthly':
            return `${minutes} ${hours} 1 * *`;
        default:
            return `${minutes} ${hours} * * ${day}`;
    }
}

// 백업 스케줄 업데이트
function updateBackupSchedule(settings) {
    if (currentCronJob) {
        currentCronJob.stop();
    }

    if (!settings.is_auto_backup || !settings.backup_email) {
        return;
    }

    const cronExpression = generateCronExpression(
        settings.backup_time,
        settings.backup_interval,
        settings.backup_day
    );

    currentCronJob = cron.schedule(cronExpression, () => {
        console.log('자동 백업 시작:', new Date().toLocaleString());
        sendBackupEmail(settings.backup_email);
    });
}

// 수동 백업 실행
async function runBackupNow(email) {
    if (!email) {
        throw new Error('백업 이메일 주소가 필요합니다.');
    }
    return await sendBackupEmail(email);
}

module.exports = {
    updateBackupSchedule,
    runBackupNow
};