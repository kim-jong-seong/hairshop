document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('errorMessage');
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            sessionStorage.setItem('isLoggedIn', 'true');
            sessionStorage.setItem('isAdmin', data.isAdmin);  // 관리자 여부 저장
            window.location.href = '/dashboard.html';
        } else {
            errorMessage.textContent = data.message || '로그인에 실패했습니다.';
            errorMessage.style.display = 'block';
            document.getElementById('password').value = '';
        }
    } catch (err) {
        errorMessage.textContent = '서버 연결에 실패했습니다.';
        errorMessage.style.display = 'block';
    }
});

function getPgmId() {
    return "login";
}