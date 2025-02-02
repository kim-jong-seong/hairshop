// 로그인 상태 체크
function checkLogin() {
    const isLoggedIn = sessionStorage.getItem('isLoggedIn');
    if (!isLoggedIn) {
        window.location.href = '/';
    }
}

// 페이지 로드 시 로그인 체크
checkLogin();

// 전역 데이터 캐시
let cachedData = {
    history: [],
    customers: [],
    services: []
};

// 정렬 상태 관리
let sortState = {
    history: { column: 'created_at', direction: 'desc' },
    customers: { column: 'name', direction: 'asc' },
    customerHistory: { column: 'created_at', direction: 'desc' }
};

// 테이블 컬럼 정의
const TABLE_COLUMNS = {
    history: [
        { key: 'index', label: '번호', sortable: false },
        { key: 'created_at', label: '날짜' },
        { key: 'customer_name', label: '이름' },
        { key: 'gender', label: '성별' },
        { key: 'phone', label: '전화번호' },
        { key: 'service_name', label: '시술종류' },
        { key: 'amount', label: '금액' },
        { key: 'memo', label: '메모', sortable: false }
    ],
    customers: [
        { key: 'index', label: '번호', sortable: false },
        { key: 'name', label: '이름' },
        { key: 'gender', label: '성별' },
        { key: 'phone', label: '전화번호' },
        { key: 'memo', label: '메모', sortable: false }
    ],
    customerHistory: [
        { key: 'index', label: '번호', sortable: false },
        { key: 'created_at', label: '날짜' },
        { key: 'service_name', label: '시술종류' },
        { key: 'amount', label: '금액' },
        { key: 'memo', label: '메모', sortable: false }
    ]
};


// DOM 요소
const navItems = document.querySelectorAll('.nav-item');
const pages = document.querySelectorAll('.page');
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modalTitle');
const modalBody = document.getElementById('modalBody');
const closeBtn = document.querySelector('.close-btn');

// 네비게이션 이벤트
navItems.forEach(item => {
    item.addEventListener('click', () => {
        const pageId = item.getAttribute('data-page');
        changePage(pageId);
    });
});

// 페이지 전환
function changePage(pageId) {
    navItems.forEach(item => {
        item.classList.toggle('active', item.getAttribute('data-page') === pageId);
    });
    pages.forEach(page => {
        page.classList.toggle('hidden', page.id !== pageId + '-page');
    });

    // 메인화면으로 전환될 때 applyMainSearch 실행
    if (pageId === 'main') {
        applyMainSearch();
    }
}

// 모달 관련 함수
function showModal(title, content) {
    modalTitle.textContent = title;
    modalBody.innerHTML = content;
    modal.classList.remove('hidden');
}

function hideModal() {
    modal.classList.add('hidden');
}

closeBtn.addEventListener('click', hideModal);

// 정렬 함수
function sortData(data, column, direction) {
    return [...data].sort((a, b) => {
        let valueA = a[column];
        let valueB = b[column];

        // 날짜 형식 처리
        if (column === 'created_at') {
            valueA = new Date(valueA);
            valueB = new Date(valueB);
        }
        // 숫자 형식 처리
        else if (column === 'amount') {
            valueA = Number(valueA);
            valueB = Number(valueB);
        }
        // 문자열 처리
        else {
            valueA = String(valueA || '').toLowerCase();
            valueB = String(valueB || '').toLowerCase();
        }

        if (direction === 'asc') {
            return valueA > valueB ? 1 : -1;
        } else {
            return valueA < valueB ? 1 : -1;
        }
    });
}

// 정렬 방향 토글
function toggleSortDirection(currentDirection) {
    switch (currentDirection) {
        case 'asc':
            return 'desc';
        case 'desc':
            return 'default';
        default:
            return 'asc';
    }
}

// API 호출 함수들
async function fetchCustomers() {
    const response = await fetch('/api/customers');
    return await response.json();
}

async function fetchServices() {
    const response = await fetch('/api/services');
    return await response.json();
}

async function fetchHistory(customerId = null) {
    let url = '/api/history';
    const params = new URLSearchParams();
    
    if (customerId) {
        params.append('customer_id', customerId);
    } else {
        // 메인화면 조회 시에만 날짜 필터 적용
        if (mainSearchCriteria?.year) params.append('year', mainSearchCriteria.year);
        if (mainSearchCriteria?.month) params.append('month', mainSearchCriteria.month);
        if (mainSearchCriteria?.day) params.append('day', mainSearchCriteria.day);
    }

    if (params.toString()) {
        url += '?' + params.toString();
    }
    
    const response = await fetch(url);
    return await response.json();
}

// 테이블 헤더 클릭 이벤트 설정
function setupTableSorting(tableId, sortKey) {
    const table = document.querySelector(`#${tableId}`).closest('table');
    if (!table) return;

    const headers = table.querySelectorAll('thead th');
    const columns = TABLE_COLUMNS[sortKey];

    headers.forEach((header, index) => {
        if (columns[index].sortable !== false) {
            header.style.cursor = 'pointer';
            header.addEventListener('click', () => {
                const column = columns[index].key;
                if (sortState[sortKey].column === column) {
                    sortState[sortKey].direction = toggleSortDirection(sortState[sortKey].direction);
                } else {
                    sortState[sortKey].column = column;
                    sortState[sortKey].direction = 'asc';
                }

                // 정렬 표시 업데이트
                headers.forEach(h => h.classList.remove('sort-asc', 'sort-desc'));
                if (sortState[sortKey].direction !== 'default') {
                    header.classList.add(`sort-${sortState[sortKey].direction}`);
                }

                // 데이터 다시 로드
                const data = sortState[sortKey].direction === 'default' 
                    ? [...cachedData[sortKey]] // 기본 상태면 원본 데이터 복사
                    : sortData(cachedData[sortKey], column, sortState[sortKey].direction);

                if (sortKey === 'history') {
                    renderHistoryTable(data);
                } else if (sortKey === 'customers') {
                    renderCustomerTable(data);
                } else if (sortKey === 'customerHistory' && currentHistoryData) {
                    renderCustomerHistoryTable(data);
                }
            });
        }
    });
}

// 고객 추가 모달
document.getElementById('addCustomerBtn').addEventListener('click', () => {
    showModal('새 고객 등록', `
        <form id="customerForm">
            <div class="form-group">
                <label>이름</label>
                <input type="text" name="name" required>
            </div>
            <div class="form-group">
                <label>성별</label>
                <select name="gender">
                    <option value="남">남</option>
                    <option value="여">여</option>
                </select>
            </div>
            <div class="form-group">
                <label>전화번호</label>
                <input type="tel" name="phone">
            </div>
            <div class="form-group">
                <label>메모</label>
                <textarea name="memo"></textarea>
            </div>
            <div class="addButtonWrap">
                <button type="submit" class="add-button">등록</button>
            </div>
        </form>
    `);

    document.getElementById('customerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const customerData = Object.fromEntries(formData.entries());

        try {
            const response = await fetch('/api/customers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(customerData)
            });

            if (response.ok) {
                const newCustomer = await response.json();
                cachedData.customers.push({...customerData, id: newCustomer.id});
                renderCustomerTable(sortData(
                    cachedData.customers,
                    sortState.customers.column,
                    sortState.customers.direction
                ));
                hideModal();
                alert("등록되었습니다.");
            }
        } catch (error) {
            console.error('Error:', error);
            alert('고객 등록에 실패했습니다.');
        }
    });
});

// 현재 시간을 YYYY-MM-DDTHH:mm 형식으로 반환하는 함수
function getCurrentDateTime() {
    const now = new Date();
    now.setHours(now.getHours() + 9); // UTC+9
    return now.toISOString().slice(0, 16);
}

// 시술 내역 추가 모달
document.getElementById('addHistoryBtn').addEventListener('click', async () => {
    // 선택된 고객 확인
    const selectedRow = document.querySelector('#customerTableBody tr.selected');
    if (!selectedRow) {
        alert('고객을 먼저 선택해주세요.');
        return;
    }

    const selectedCustomerId = selectedRow.getAttribute('data-id');
    const selectedCustomer = cachedData.customers.find(c => c.id === parseInt(selectedCustomerId));

    if (cachedData.services.length === 0) {
        await loadServices();
    }

    // 시술 목록을 즐겨찾기 기준으로 정렬
    const sortedServices = [...cachedData.services].sort((a, b) => {
        if (a.is_favorite === b.is_favorite) {
            return a.name.localeCompare(b.name); // 같은 그룹 내에서는 이름순
        }
        return b.is_favorite - a.is_favorite; // 즐겨찾기가 먼저 오도록
    });

    showModal('새 시술 등록', `
        <form id="historyForm">
            <div class="form-group">
                <label>고객</label>
                <input type="text" value="${selectedCustomer.name}" readonly style="background-color: #eee;">
                <input type="hidden" name="customer_id" value="${selectedCustomer.id}">
            </div>
            <div class="form-group">
                <label>시술종류</label>
                <select name="service_id" required onchange="updateServicePrice(this.value)">
                    <option value="">시술 선택</option>
                    ${sortedServices.map(s => `
                        <option value="${s.id}" data-price="${s.price}">
                            ${s.is_favorite ? '★ ' : ''}${s.name} -  ${s.price.toLocaleString()}원
                        </option>
                    `).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>금액</label>
                <input type="number" name="amount" id="serviceAmount" required>
            </div>
            <div class="form-group">
                <label>메모</label>
                <textarea name="memo"></textarea>
            </div>
            <div class="form-group">
                <label>날짜/시간</label>
                <input type="datetime-local" name="created_at" required value="${getCurrentDateTime()}">
            </div>
            <div class="addButtonWrap">
                <button type="submit" class="add-button">등록</button>
            </div>
        </form>
    `);

    // 폼 제출 이벤트
    document.getElementById('historyForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const historyData = Object.fromEntries(formData.entries());

        try {
            const response = await fetch('/api/history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(historyData)
            });

            if (response.ok) {
                // 캐시 데이터 새로고침 필요 (관계 데이터가 포함되어 있어서)
                cachedData.history = await fetchHistory();
                renderHistoryTable(sortData(
                    cachedData.history,
                    sortState.history.column,
                    sortState.history.direction
                ));
                
                // 고객 히스토리도 업데이트
                currentHistoryData = await fetchHistory(selectedCustomerId);
                renderCustomerHistoryTable(sortData(
                    currentHistoryData,
                    sortState.customerHistory.column,
                    sortState.customerHistory.direction
                ));
                
                hideModal();
                alert("등록되었습니다.");
            }
        } catch (error) {
            console.error('Error:', error);
            alert('시술 내역 등록에 실패했습니다.');
        }
    });
});

// 시술 내역 수정 모달
async function showHistoryEditModal(history) {
    if (cachedData.services.length === 0) await loadServices();

    // created_at을 datetime-local 입력에 맞는 형식으로 변환
    const historyDate = new Date(history.created_at);
    historyDate.setHours(historyDate.getHours() + 9); // UTC+9
    const formattedDate = historyDate.toISOString().slice(0, 16);

    // 시술 목록을 즐겨찾기 기준으로 정렬
    const sortedServices = [...cachedData.services].sort((a, b) => {
        if (a.is_favorite === b.is_favorite) {
            return a.name.localeCompare(b.name); // 같은 그룹 내에서는 이름순
        }
        return b.is_favorite - a.is_favorite; // 즐겨찾기가 먼저 오도록
    });

    showModal('시술 내역 수정', `
        <form id="historyEditForm">
            <input type="hidden" name="id" value="${history.id}">
            <div class="form-group">
                <label>고객</label>
                <input type="text" value="${history.customer_name}" readonly style="background-color: #eee;>
                <input type="hidden" name="customer_id" value="${history.customer_id}">
            </div>
            <div class="form-group">
                <label>시술종류</label>
                <select name="service_id" required onchange="updateServicePrice(this.value)">
                    <option value="">시술 선택</option>
                    ${sortedServices.map(s => `
                        <option value="${s.id}" data-price="${s.price}" ${s.id === history.service_id ? 'selected' : ''}>
                            ${s.is_favorite ? '★ ' : ''}${s.name} - ${s.price.toLocaleString()}원
                        </option>
                    `).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>금액</label>
                <input type="number" name="amount" id="serviceAmount" required value="${history.amount}">
            </div>
            <div class="form-group">
                <label>메모</label>
                <textarea name="memo">${history.memo || ''}</textarea>
            </div>
            <div class="form-group">
                <label>날짜/시간</label>
                <input type="datetime-local" name="created_at" required value="${formattedDate}">
            </div>
            <div class="addButtonWrap modal-buttons">
                <div class="left-buttons">
                    <button type="button" class="delete-button" onclick="deleteHistory(${history.id})">삭제</button>
                </div>
                <button type="submit" class="add-button">수정</button>
            </div>
        </form>
    `);

    document.getElementById('historyEditForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const historyData = Object.fromEntries(formData.entries());

        try {
            const response = await fetch(`/api/history/${history.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(historyData)
            });

            if (response.ok) {
                cachedData.history = await fetchHistory();
                applyMainSearch();
                if (currentHistoryData.length > 0) {
                    currentHistoryData = await fetchHistory(history.customer_id);
                    renderCustomerHistoryTable(sortData(
                        currentHistoryData,
                        sortState.customerHistory.column,
                        sortState.customerHistory.direction
                    ));
                }
                hideModal();

                alert("수정되었습니다.");
            }
        } catch (error) {
            console.error('Error:', error);
            alert('시술 내역 수정에 실패했습니다.');
        }
    });
}

// 고객 정보 수정 모달
function showCustomerEditModal(customer) {
    showModal('고객 정보 수정', `
        <form id="customerEditForm">
            <input type="hidden" name="id" value="${customer.id}">
            <div class="form-group">
                <label>이름</label>
                <input type="text" name="name" required value="${customer.name}" style="background-color: #eee;">
            </div>
            <div class="form-group">
                <label>성별</label>
                <select name="gender">
                    <option value="남" ${customer.gender === '남' ? 'selected' : ''}>남</option>
                    <option value="여" ${customer.gender === '여' ? 'selected' : ''}>여</option>
                </select>
            </div>
            <div class="form-group">
                <label>전화번호</label>
                <input type="tel" name="phone" value="${customer.phone || ''}">
            </div>
            <div class="form-group">
                <label>메모</label>
                <textarea name="memo">${customer.memo || ''}</textarea>
            </div>
            <div class="addButtonWrap modal-buttons">
                <div class="left-buttons">
                    <button type="button" class="delete-button" onclick="deleteCustomer(${customer.id})">삭제</button>
                </div>
                <button type="submit" class="add-button">수정</button>
            </div>
        </form>
    `);

    document.getElementById('customerEditForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const customerData = Object.fromEntries(formData.entries());

        try {
            const response = await fetch(`/api/customers/${customer.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(customerData)
            });

            if (response.ok) {
                cachedData.customers = await fetchCustomers();
                applySearch();
                hideModal();

                alert("수정되었습니다.");
            }
        } catch (error) {
            console.error('Error:', error);
            alert('고객 정보 수정에 실패했습니다.');
        }
    });
}

// 삭제 함수 추가
async function deleteHistory(historyId) {
    if (!confirm('이 시술 내역을 삭제하시겠습니까?')) {
        return;
    }

    try {
        const response = await fetch(`/api/history/${historyId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            cachedData.history = await fetchHistory();
            applyMainSearch();
            if (currentHistoryData.length > 0) {
                const customerId = currentHistoryData[0].customer_id;
                currentHistoryData = await fetchHistory(customerId);
                renderCustomerHistoryTable(sortData(
                    currentHistoryData,
                    sortState.customerHistory.column,
                    sortState.customerHistory.direction
                ));
            }
            hideModal();

            alert("삭제되었습니다.");
        }
    } catch (error) {
        console.error('Error:', error);
        alert('시술 내역 삭제에 실패했습니다.');
    }
}

async function deleteCustomer(customerId) {
    if (!confirm('이 고객의 모든 정보와 시술 내역이 삭제됩니다. 계속하시겠습니까?')) {
        return;
    }

    try {
        const response = await fetch(`/api/customers/${customerId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            cachedData.customers = await fetchCustomers();
            cachedData.history = await fetchHistory(); // 전체 히스토리도 다시 로드
            currentHistoryData = [];
            applySearch();
            applyMainSearch();
            hideModal();

            alert("삭제되었습니다.");
        }
    } catch (error) {
        console.error('Error:', error);
        alert('고객 정보 삭제에 실패했습니다.');
    }
}

// 시술 선택 시 금액 자동 설정 함수
window.updateServicePrice = function(serviceId) {
    const service = cachedData.services.find(s => s.id === parseInt(serviceId));
    if (service) {
        document.getElementById('serviceAmount').value = service.price;
    }
};

// 시술 추가
document.getElementById('addServiceBtn').addEventListener('click', async () => {
    const serviceName = document.getElementById('newServiceName').value;
    const servicePrice = document.getElementById('newServicePrice').value;

    if (!serviceName) {
        alert('시술명을 입력해주세요.');
        return;
    }
    if (!servicePrice) {
        alert('금액을 입력해주세요.');
        return;
    }

    try {
        const response = await fetch('/api/services', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                name: serviceName,
                price: parseInt(servicePrice)
            })
        });

        if (response.ok) {
            const newService = await response.json();
            cachedData.services.push({ 
                name: serviceName, 
                price: parseInt(servicePrice),
                id: newService.id, 
                is_favorite: false 
            });
            document.getElementById('newServiceName').value = '';
            document.getElementById('newServicePrice').value = '';
            renderServicesTable(cachedData.services);
            alert("등록되었습니다.");
        }
    } catch (error) {
        console.error('Error:', error);
        alert('시술 등록에 실패했습니다.');
    }
});

// 렌더링 함수들
function renderHistoryTable(data) {
    const tbody = document.getElementById('historyTableBody');
    tbody.innerHTML = data.map((item, index) => `
        <tr data-id="${item.id}" data-customer-id="${item.customer_id}" data-service-id="${item.service_id}">
            <td>${index + 1}</td>
            <td>${formatDate(item.created_at)}</td>
            <td>${item.customer_name}</td>
            <td>${item.gender || '-'}</td>
            <td>${item.phone || '-'}</td>
            <td>${item.service_name}</td>
            <td class="alignRight">${item.amount.toLocaleString()}</td>
            <td class="alignLeft">${item.memo || '-'}</td>
        </tr>
    `).join('');

    // 더블클릭 이벤트 추가
    tbody.querySelectorAll('tr').forEach(row => {
        row.addEventListener('dblclick', () => {
            const historyId = row.getAttribute('data-id');
            const history = data.find(item => item.id === parseInt(historyId));
            showHistoryEditModal(history);
        });
    });
}

// 검색기능

// 메인화면 검색 기준
let mainSearchCriteria = {
    date: '',
    name: '',
    gender: '',
    phone: '',
    service: '',
    memo: ''
};

// 각 검색 필드에 대한 이벤트 리스너 추가
document.getElementById('dateSearch').addEventListener('input', function(e) {
    mainSearchCriteria.date = e.target.value;
    applyMainSearch();
});

document.getElementById('mainNameSearch').addEventListener('input', function(e) {
    mainSearchCriteria.name = e.target.value.toLowerCase();
    applyMainSearch();
});

document.getElementById('genderSearch').addEventListener('change', function(e) {
    mainSearchCriteria.gender = e.target.value;
    applyMainSearch();
});

document.getElementById('mainPhoneSearch').addEventListener('input', function(e) {
    mainSearchCriteria.phone = e.target.value.toLowerCase();
    applyMainSearch();
});

document.getElementById('serviceSearch').addEventListener('input', function(e) {
    mainSearchCriteria.service = e.target.value.toLowerCase();
    applyMainSearch();
});

document.getElementById('mainMemoSearch').addEventListener('input', function(e) {
    mainSearchCriteria.memo = e.target.value.toLowerCase();
    applyMainSearch();
});

// 메인화면 검색 적용 함수
function applyMainSearch() {
    const filteredHistory = cachedData.history.filter(item => {
        const dateMatch = !mainSearchCriteria.date || 
            item.created_at.startsWith(mainSearchCriteria.date);
        const nameMatch = !mainSearchCriteria.name || 
            item.customer_name?.toLowerCase().includes(mainSearchCriteria.name);
        const genderMatch = !mainSearchCriteria.gender || 
            item.gender === mainSearchCriteria.gender;
        const phoneMatch = !mainSearchCriteria.phone || 
            item.phone?.toLowerCase().includes(mainSearchCriteria.phone);
        const serviceMatch = !mainSearchCriteria.service || 
            item.service_name?.toLowerCase().includes(mainSearchCriteria.service);
        const memoMatch = !mainSearchCriteria.memo || 
            item.memo?.toLowerCase().includes(mainSearchCriteria.memo);

        return dateMatch && nameMatch && genderMatch && phoneMatch && 
               serviceMatch && memoMatch;
    });

    // 총 금액 계산
    const totalAmount = filteredHistory.reduce((sum, item) => sum + (item.amount || 0), 0);
    document.getElementById('totalAmount').textContent = totalAmount.toLocaleString() + '원';

    renderHistoryTable(sortData(
        filteredHistory,
        sortState.history.column,
        sortState.history.direction
    ));
}

// 검색 기능 구현
let searchCriteria = {
    name: '',
    phone: '',
    memo: ''
};

// 각 검색 필드에 대한 이벤트 리스너 추가
document.getElementById('nameSearch').addEventListener('input', function(e) {
    searchCriteria.name = e.target.value.toLowerCase();
    applySearch();
});

document.getElementById('phoneSearch').addEventListener('input', function(e) {
    searchCriteria.phone = e.target.value.toLowerCase();
    applySearch();
});

document.getElementById('memoSearch').addEventListener('input', function(e) {
    searchCriteria.memo = e.target.value.toLowerCase();
    applySearch();
});

// 검색 적용 함수
function applySearch() {
    const filteredCustomers = cachedData.customers.filter(customer => {
        const nameMatch = !searchCriteria.name || 
            (customer.name?.toLowerCase().includes(searchCriteria.name));
        const phoneMatch = !searchCriteria.phone || 
            (customer.phone?.toLowerCase().includes(searchCriteria.phone));
        const memoMatch = !searchCriteria.memo || 
            (customer.memo?.toLowerCase().includes(searchCriteria.memo));

        return nameMatch && phoneMatch && memoMatch;
    });

    renderCustomerTable(sortData(
        filteredCustomers,
        sortState.customers.column,
        sortState.customers.direction
    ));
}

function renderCustomerTable(data) {
    const tbody = document.getElementById('customerTableBody');
    tbody.innerHTML = data.map((customer, index) => `
        <tr data-id="${customer.id}">
            <td>${index + 1}</td>
            <td>${customer.name}</td>
            <td>${customer.gender || '-'}</td>
            <td>${customer.phone || '-'}</td>
            <td class="alignLeft">${customer.memo || '-'}</td>
        </tr>
    `).join('');

    // 고객 클릭 이벤트는 그대로 유지
    tbody.querySelectorAll('tr').forEach(row => {
        row.addEventListener('click', async () => {
            const customerId = row.getAttribute('data-id');
            currentHistoryData = await fetchHistory(customerId);
            renderCustomerHistoryTable(sortData(
                currentHistoryData,
                sortState.customerHistory.column,
                sortState.customerHistory.direction
            ));
            
            tbody.querySelectorAll('tr').forEach(r => r.classList.remove('selected'));
            row.classList.add('selected');
        });

        // 더블클릭 이벤트 추가
        row.addEventListener('dblclick', () => {
            const customerId = row.getAttribute('data-id');
            const customer = data.find(c => c.id === parseInt(customerId));
            showCustomerEditModal(customer);
        });
    });
}

function renderCustomerHistoryTable(data) {
    const tbody = document.getElementById('customerHistoryTableBody');
    tbody.innerHTML = data.map((item, index) => `
        <tr data-id="${item.id}">
            <td>${index + 1}</td>
            <td>${formatDate(item.created_at)}</td>
            <td>${item.service_name}</td>
            <td class="alignRight">${item.amount.toLocaleString()}</td>
            <td class="alignLeft">${item.memo || '-'}</td>
        </tr>
    `).join('');

    // 더블클릭 이벤트 추가
    tbody.querySelectorAll('tr').forEach(row => {
        row.addEventListener('dblclick', () => {
            const historyId = row.getAttribute('data-id');
            const history = data.find(item => item.id === parseInt(historyId));
            showHistoryEditModal(history);
        });
    });
}

function renderServicesTable(data) {
    const tbody = document.getElementById('servicesTableBody');
    tbody.innerHTML = data.map(service => `
        <tr data-id="${service.id}">
            <td>
                <span class="star-icon ${service.is_favorite ? 'active' : ''}"
                    onclick="toggleFavorite(${service.id}, ${!service.is_favorite})">★</span>
            </td>
            <td>
                <span class="editable" data-field="name">${service.name}</span>
            </td>
            <td>
                <span class="editable" data-field="price">${service.price.toLocaleString()}</span>
            </td>
        </tr>
    `).join('');

    // 수정 가능한 필드에 더블클릭 이벤트 추가
    tbody.querySelectorAll('.editable').forEach(element => {
        element.addEventListener('dblclick', function() {
            const field = this.dataset.field;
            const tr = this.closest('tr');
            const serviceId = tr.dataset.id;
            const currentValue = field === 'price' ? 
                this.textContent.replace(/[^0-9]/g, '') : this.textContent;

            showServiceEditModal(serviceId, field, currentValue);
        });
    });
}

// 시술 정보 수정 모달
function showServiceEditModal(serviceId, field, currentValue) {
    const fieldName = field === 'name' ? '시술명' : '금액';
    const inputType = field === 'name' ? 'text' : 'number';
    
    showModal(`${fieldName} 수정`, `
        <form id="serviceEditForm">
            <div class="form-group">
                <label>${fieldName}</label>
                <input type="${inputType}" name="${field}" 
                       value="${currentValue}" required
                       ${field === 'price' ? 'min="0"' : ''}>
            </div>
            <div class="serviceEdit_modal-buttons">
                <button type="submit" class="add-button">수정</button>
            </div>
        </form>
    `);

    document.getElementById('serviceEditForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const value = formData.get(field);

        try {
            const service = cachedData.services.find(s => s.id === parseInt(serviceId));
            const updateData = {
                name: field === 'name' ? value : service.name,
                price: field === 'price' ? parseInt(value) : service.price
            };

            const response = await fetch(`/api/services/${serviceId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData)
            });

            if (response.ok) {
                // 캐시된 데이터 업데이트
                Object.assign(service, updateData);
                renderServicesTable(cachedData.services);
                hideModal();
                alert("수정되었습니다.");
            }
        } catch (error) {
            console.error('Error:', error);
            alert('시술 정보 수정에 실패했습니다.');
        }
    });
}

// 데이터 로드 함수들
let currentHistoryData = []; // 현재 고객의 히스토리 데이터 저장

async function loadHistory() {
    if (cachedData.history.length === 0) {
        cachedData.history = await fetchHistory();
    }
    renderHistoryTable(sortData(
        cachedData.history,
        sortState.history.column,
        sortState.history.direction
    ));
    setupTableSorting('historyTableBody', 'history');
}

async function loadCustomers() {
    if (cachedData.customers.length === 0) {
        cachedData.customers = await fetchCustomers();
    }
    renderCustomerTable(sortData(
        cachedData.customers,
        sortState.customers.column,
        sortState.customers.direction
    ));
    setupTableSorting('customerTableBody', 'customers');
}

async function loadServices() {
    if (cachedData.services.length === 0) {
        cachedData.services = await fetchServices();
    }
    renderServicesTable(cachedData.services);
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}`;
}

// 즐겨찾기 토글
window.toggleFavorite = async function(serviceId, isFavorite) {
    try {
        const response = await fetch(`/api/services/${serviceId}/favorite`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_favorite: isFavorite })
        });

        if (response.ok) {
            // 캐시된 데이터 업데이트
            const service = cachedData.services.find(s => s.id === serviceId);
            if (service) {
                service.is_favorite = isFavorite;
                renderServicesTable(cachedData.services);
            }
        }
    } catch (error) {
        console.error('Error:', error);
        alert('즐겨찾기 설정에 실패했습니다.');
    }
};

// 로그아웃
document.getElementById('logoutBtn').addEventListener('click', () => {
    sessionStorage.removeItem('isLoggedIn');
    window.location.href = '/';
});

// 초기 데이터 로드 전에 오늘 날짜 설정 함수 추가
function setTodayDate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const formattedDate = `${year}-${month}-${day}`;
    
    const dateSearch = document.getElementById('dateSearch');
    dateSearch.value = formattedDate;
    mainSearchCriteria.date = formattedDate;
}

// 초기 데이터 로드 부분 수정
async function loadHistory() {
    if (cachedData.history.length === 0) {
        cachedData.history = await fetchHistory();
    }
    applyMainSearch();  // renderHistoryTable 대신 applyMainSearch 호출
    setupTableSorting('historyTableBody', 'history');
}

// 초기 데이터 로드
loadCustomers();
loadServices();
setTodayDate();  // 날짜 먼저 설정
loadHistory();