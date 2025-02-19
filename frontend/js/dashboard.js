// 모바일 아이콘 정의
const ICONS = {
    calendar: `<svg class="icon" viewBox="0 0 24 24">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="16" y1="2" x2="16" y2="6"></line>
        <line x1="8" y1="2" x2="8" y2="6"></line>
        <line x1="3" y1="10" x2="21" y2="10"></line>
    </svg>`,
    user: `<svg class="icon" viewBox="0 0 24 24">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
        <circle cx="12" cy="7" r="4"></circle>
    </svg>`,
    service: `<svg class="icon" viewBox="0 0 24 24">
        <circle cx="6" cy="6" r="3"/>
        <circle cx="6" cy="18" r="3"/>
        <line x1="20" y1="4" x2="8.12" y2="15.88"/>
        <line x1="14.47" y1="14.48" x2="20" y2="20"/>
        <line x1="8.12" y1="8.12" x2="12" y2="12"/>
    </svg>`,
    phone: `<svg class="icon" viewBox="0 0 24 24">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
    </svg>`,
    memo: `<svg class="icon" viewBox="0 0 24 24">
        <line x1="4" y1="9" x2="20" y2="9"></line>
        <line x1="4" y1="15" x2="20" y2="15"></line>
        <line x1="10" y1="3" x2="8" y2="21"></line>
        <line x1="16" y1="3" x2="14" y2="21"></line>
    </svg>`
};

function getPgmId() {
    return "dashboard";
}

// 페이지 로드 시 관리자 체크
window.addEventListener('DOMContentLoaded', () => {
    const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
    const adminElements = document.querySelectorAll('.admin-only');
    
    adminElements.forEach(el => {
        el.classList.toggle('hidden', !isAdmin);
    });
});

// 데이터베이스 다운로드 버튼 이벤트
document.getElementById('downloadDbBtn')?.addEventListener('click', async () => {
    try {
        const response = await fetch('/api/database/download');
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'database.db';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    } catch (error) {
        console.error('Error:', error);
        alert('데이터베이스 다운로드에 실패했습니다.');
    }
});

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
    customerHistory: { column: 'created_at', direction: 'desc' },
    sales: { column: 'period', direction: 'asc' }
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
    ],
    sales: [
        { key: 'period', label: '기간' },
        { key: 'count', label: '시술 건수' },
        { key: 'total', label: '매출' }
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

    document.querySelectorAll('.mobile-nav-item').forEach(item => {
        item.classList.toggle('active', item.getAttribute('data-page') === pageId);
    });

    pages.forEach(page => {
        page.classList.toggle('hidden', page.id !== pageId + '-page');
    });

    // 페이지 전환 시 스크롤을 맨 위로
    document.querySelector('.main-content').scrollTo({
        top: 0
    });

    // 메인화면으로 전환될 때 applyMainSearch 실행
    if (pageId === 'main') {
        applyMainSearch();
    }

    // 매출관리 페이지로 전환 시 데이터 로드
    if (pageId === 'sales') {
        initializeSalesPage();
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
    if (direction === 'default') {
        return data;
    }

    return [...data].sort((a, b) => {
        let valueA = a[column];
        let valueB = b[column];

        // 특수한 정렬 처리
        if (column === 'created_at') {
            valueA = new Date(valueA).getTime();
            valueB = new Date(valueB).getTime();
        } else if (column === 'amount' || column === 'price' || 
                   column === 'count' || column === 'total') {
            valueA = Number(valueA) || 0;
            valueB = Number(valueB) || 0;
        } else if (column === 'period') {
            valueA = a[column].replace(/[^0-9]/g, '');
            valueB = b[column].replace(/[^0-9]/g, '');
        } else {
            valueA = String(valueA || '').toLowerCase();
            valueB = String(valueB || '').toLowerCase();
        }

        if (direction === 'asc') {
            return valueA > valueB ? 1 : valueA < valueB ? -1 : 0;
        } else {
            return valueA < valueB ? 1 : valueA > valueB ? -1 : 0;
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

function updateSortIndicators(headers, currentColumn, direction) {
    headers.forEach(header => {
        header.classList.remove('sort-asc', 'sort-desc');
        if (direction !== 'default') {
            const columnKey = TABLE_COLUMNS[header.closest('table').id.replace('TableBody', '')].find(
                (col, index) => index === Array.from(headers).indexOf(header)
            )?.key;
            
            if (columnKey === currentColumn) {
                header.classList.add(`sort-${direction}`);
            }
        }
    });
}

// 기본 정렬 컬럼 가져오기
function getDefaultSortColumn(sortKey) {
    switch (sortKey) {
        case 'history':
            return 'created_at';
        case 'customers':
            return 'name';
        case 'customerHistory':
            return 'created_at';
        case 'sales':
            return 'period';
        default:
            return '';
    }
}

// 기본 정렬 방향 가져오기
function getDefaultSortDirection(sortKey) {
    switch (sortKey) {
        case 'history':
            return 'desc';
        case 'customers':
            return 'asc';
        case 'customerHistory':
            return 'desc';
        case 'sales':
            return 'asc';
        default:
            return 'asc';
    }
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
                
                // 정렬 상태 업데이트
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

                // 데이터 정렬 및 테이블 업데이트
                let dataToSort;
                switch (sortKey) {
                    case 'history':
                        dataToSort = [...cachedData.history];
                        if (mainSearchCriteria.date || mainSearchCriteria.name || 
                            mainSearchCriteria.gender || mainSearchCriteria.phone || 
                            mainSearchCriteria.service || mainSearchCriteria.memo) {
                            dataToSort = dataToSort.filter(item => {
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
                        }
                        renderHistoryTable(sortData(dataToSort, column, sortState[sortKey].direction));
                        break;

                    case 'customers':
                        dataToSort = [...cachedData.customers];
                        if (searchCriteria.name || searchCriteria.phone || searchCriteria.memo) {
                            dataToSort = dataToSort.filter(customer => {
                                const nameMatch = !searchCriteria.name || 
                                    customer.name?.toLowerCase().includes(searchCriteria.name);
                                const phoneMatch = !searchCriteria.phone || 
                                    customer.phone?.toLowerCase().includes(searchCriteria.phone);
                                const memoMatch = !searchCriteria.memo || 
                                    customer.memo?.toLowerCase().includes(searchCriteria.memo);
                                return nameMatch && phoneMatch && memoMatch;
                            });
                        }
                        renderCustomerTable(sortData(dataToSort, column, sortState[sortKey].direction));
                        break;

                    case 'customerHistory':
                        renderCustomerHistoryTable(sortData(
                            currentHistoryData,
                            column,
                            sortState[sortKey].direction
                        ));
                        break;

                    case 'sales':
                        loadSalesData();
                        break;
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
                <input id="modalName" type="text" name="name" required>
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

    document.getElementById('modalName').focus();

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
    // 기존 선택된 고객 확인 로직을 모바일 대응으로 수정
    let selectedCustomer;
    if (window.innerWidth <= 768) {
        // 모바일에서는 카드에서 선택된 고객 찾기
        const selectedCard = document.querySelector('.mobile-customer-list .customer-list-card.selected');
        if (!selectedCard) {
            alert('고객을 먼저 선택해주세요.');
            return;
        }
        selectedCustomerId = selectedCard.getAttribute('data-id');
        selectedCustomer = cachedData.customers.find(c => c.id === parseInt(selectedCustomerId));
    } else {
        // 데스크톱에서는 기존 방식대로 테이블 row에서 찾기
        const selectedRow = document.querySelector('#customerTableBody tr.selected');
        if (!selectedRow) {
            alert('고객을 먼저 선택해주세요.');
            return;
        }
        selectedCustomerId = selectedRow.getAttribute('data-id');
        selectedCustomer = cachedData.customers.find(c => c.id === parseInt(selectedCustomerId));
    }

    if (!selectedCustomer) {
        alert('고객을 먼저 선택해주세요.');
        return;
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
                <input id="modalAmount" type="number" name="amount" id="serviceAmount" required value="${history.amount}">
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

    document.getElementById('modalAmount').focus();
    document.getElementById('modalAmount').select();

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
                <input id="modalName" type="text" name="name" required value="${customer.name}">
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

    document.getElementById('modalName').focus()
    document.getElementById('modalName').select();

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

// 필터링된 데이터 가져오기
function filterHistoryData() {
    return cachedData.history.filter(item => {
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
}

let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        // 전체내역 렌더링
        const currentHistoryData = filterHistoryData();
        renderHistoryTable(currentHistoryData);
        
        // 고객 목록 렌더링
        const filteredCustomers = filterCustomerData();
        renderCustomerTable(filteredCustomers);
        
        // 고객 시술내역 렌더링 (데이터가 있는 경우에만)
        if (currentHistoryData.length > 0) {
            renderCustomerHistoryTable(currentHistoryData);
        }
    }, 250);
});

// 고객 필터링 데이터 가져오기
function filterCustomerData() {
    return cachedData.customers.filter(customer => {
        const nameMatch = !searchCriteria.name || 
            customer.name?.toLowerCase().includes(searchCriteria.name);
        const phoneMatch = !searchCriteria.phone || 
            customer.phone?.toLowerCase().includes(searchCriteria.phone);
        const memoMatch = !searchCriteria.memo || 
            customer.memo?.toLowerCase().includes(searchCriteria.memo);
        return nameMatch && phoneMatch && memoMatch;
    });
}

// 렌더링 함수들
function renderHistoryTable(data) {
    if (window.innerWidth <= 768) {
        renderMobileHistory(data);
    } else {
        renderDesktopHistory(data);
    }
}

function renderMobileHistory(data) {
    const container = document.querySelector('.table-container');
    
    // 모바일 히스토리 리스트 컨테이너가 없으면 생성
    let mobileList = container.querySelector('.mobile-history-list');
    if (!mobileList) {
        mobileList = document.createElement('div');
        mobileList.className = 'mobile-history-list';
        container.appendChild(mobileList);
    }

    mobileList.innerHTML = data.map(item => `
        <div class="history-card" data-id="${item.id}" data-customer-id="${item.customer_id}" data-service-id="${item.service_id}">
            <div class="card-header">
                <div class="date">
                    ${ICONS.calendar}
                    ${formatDate(item.created_at)}
                </div>
                <div class="amount">${item.amount.toLocaleString()}원</div>
            </div>
            <div class="info-row">
                ${ICONS.user}
                <span>${item.customer_name}</span>
                ${item.gender ? `<span class="gender-badge">${item.gender}</span>` : ''}
            </div>
            <div class="info-row">
                ${ICONS.service}
                <span>${item.service_name}</span>
            </div>
            ${item.phone ? `
            <div class="info-row">
                ${ICONS.phone}
                <span>${item.phone}</span>
            </div>
            ` : ''}
            ${item.memo ? `
            <div class="info-row">
                ${ICONS.memo}
                <span class="memo">${item.memo}</span>
            </div>
            ` : ''}
        </div>
    `).join('');

    // 더블클릭 이벤트 추가
    mobileList.querySelectorAll('.history-card').forEach(card => {
        card.addEventListener('dblclick', () => {
            const historyId = card.getAttribute('data-id');
            const history = data.find(item => item.id === parseInt(historyId));
            showHistoryEditModal(history);
        });
    });
}

function renderDesktopHistory(data) {
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

// document.getElementById('mainPhoneSearch').addEventListener('input', function(e) {
//     mainSearchCriteria.phone = e.target.value.toLowerCase();
//     applyMainSearch();
// });

// document.getElementById('serviceSearch').addEventListener('input', function(e) {
//     mainSearchCriteria.service = e.target.value.toLowerCase();
//     applyMainSearch();
// });

// document.getElementById('mainMemoSearch').addEventListener('input', function(e) {
//     mainSearchCriteria.memo = e.target.value.toLowerCase();
//     applyMainSearch();
// });

// 메인화면 검색 적용 함수
function applyMainSearch() {
    const filteredHistory = cachedData.history.filter(item => {
        const dateMatch = !mainSearchCriteria.date || 
            item.created_at.startsWith(mainSearchCriteria.date);
        const nameMatch = !mainSearchCriteria.name || 
            item.customer_name?.toLowerCase().includes(mainSearchCriteria.name);
        const genderMatch = !mainSearchCriteria.gender || 
            item.gender === mainSearchCriteria.gender;
        const phoneMatch = !mainSearchCriteria.name || 
            item.phone?.toLowerCase().includes(mainSearchCriteria.name);
        const serviceMatch = !mainSearchCriteria.name || 
            item.service_name?.toLowerCase().includes(mainSearchCriteria.name);
        const memoMatch = !mainSearchCriteria.name || 
            item.memo?.toLowerCase().includes(mainSearchCriteria.name);

        return dateMatch && genderMatch 
                && ( nameMatch || phoneMatch || serviceMatch || memoMatch);
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

// document.getElementById('phoneSearch').addEventListener('input', function(e) {
//     searchCriteria.phone = e.target.value.toLowerCase();
//     applySearch();
// });

// document.getElementById('memoSearch').addEventListener('input', function(e) {
//     searchCriteria.memo = e.target.value.toLowerCase();
//     applySearch();
// });

// 검색 적용 함수
function applySearch() {
    const filteredCustomers = cachedData.customers.filter(customer => {
        const nameMatch = !searchCriteria.name || 
            (customer.name?.toLowerCase().includes(searchCriteria.name));
        const phoneMatch = !searchCriteria.name || 
            (customer.phone?.toLowerCase().includes(searchCriteria.name));
        const memoMatch = !searchCriteria.name || 
            (customer.memo?.toLowerCase().includes(searchCriteria.name));

        return nameMatch || phoneMatch || memoMatch;
    });

    renderCustomerTable(sortData(
        filteredCustomers,
        sortState.customers.column,
        sortState.customers.direction
    ));
}

function renderCustomerTable(data) {
    if (window.innerWidth <= 768) {
        renderMobileCustomerList(data);
    } else {
        renderDesktopCustomerList(data);
    }
}

function renderMobileCustomerList(data) {
    const container = document.querySelector('.customer-list .table-container');
    
    // 모바일 고객 리스트 컨테이너가 없으면 생성
    let mobileList = container.querySelector('.mobile-customer-list');
    if (!mobileList) {
        mobileList = document.createElement('div');
        mobileList.className = 'mobile-customer-list';
        container.appendChild(mobileList);
    }

    mobileList.innerHTML = data.map(customer => `
        <div class="customer-list-card" data-id="${customer.id}">
            <div class="customer-name">
                ${customer.name}
                ${customer.gender ? `<span class="gender-badge">${customer.gender}</span>` : ''}
            </div>
            ${customer.phone ? `
            <div class="info-row">
                ${ICONS.phone}
                <span>${customer.phone}</span>
            </div>
            ` : ''}
            ${customer.memo ? `
            <div class="info-row">
                ${ICONS.memo}
                <span class="memo">${customer.memo}</span>
            </div>
            ` : ''}
        </div>
    `).join('');

    // 기존 선택된 고객 표시
    const selectedRow = document.querySelector('#customerTableBody tr.selected');
    if (selectedRow) {
        const selectedId = selectedRow.getAttribute('data-id');
        mobileList.querySelector(`.customer-list-card[data-id="${selectedId}"]`)?.classList.add('selected');
    }

    // 클릭 이벤트 (고객 선택)
    mobileList.querySelectorAll('.customer-list-card').forEach(card => {
        card.addEventListener('click', async () => {
            const customerId = card.getAttribute('data-id');
            
            // 선택 상태 표시
            mobileList.querySelectorAll('.customer-list-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');

            // 시술 내역 로드
            currentHistoryData = await fetchHistory(customerId);
            renderCustomerHistoryTable(sortData(
                currentHistoryData,
                sortState.customerHistory.column,
                sortState.customerHistory.direction
            ));
        });

        // 더블클릭 이벤트 (고객 정보 수정)
        card.addEventListener('dblclick', () => {
            const customerId = card.getAttribute('data-id');
            const customer = data.find(c => c.id === parseInt(customerId));
            showCustomerEditModal(customer);
        });
    });
}

function renderDesktopCustomerList(data) {
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

    // 기존 이벤트 리스너 추가
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

        row.addEventListener('dblclick', () => {
            const customerId = row.getAttribute('data-id');
            const customer = data.find(c => c.id === parseInt(customerId));
            showCustomerEditModal(customer);
        });
    });
}

function renderCustomerHistoryTable(data) {
    if (window.innerWidth <= 768) {
        renderMobileCustomerHistory(data);
    } else {
        renderDesktopCustomerHistory(data);
    }
}

function renderMobileCustomerHistory(data) {
    const container = document.querySelector('.customer-history .table-container');
    
    // 모바일 히스토리 리스트 컨테이너가 없으면 생성
    let mobileList = container.querySelector('.customer-history-list');
    if (!mobileList) {
        mobileList = document.createElement('div');
        mobileList.className = 'customer-history-list';
        container.appendChild(mobileList);
    }

    mobileList.innerHTML = data.map(item => `
        <div class="customer-history-card" data-id="${item.id}">
            <div class="card-header">
                <div class="date">
                    ${ICONS.calendar}
                    ${formatDate(item.created_at)}
                </div>
                <div class="amount">${item.amount.toLocaleString()}원</div>
            </div>
            <div class="info-row">
                ${ICONS.service}
                <span>${item.service_name}</span>
            </div>
            ${item.memo ? `
            <div class="info-row">
                ${ICONS.memo}
                <span class="memo">${item.memo}</span>
            </div>
            ` : ''}
        </div>
    `).join('');

    // 더블클릭 이벤트 추가
    mobileList.querySelectorAll('.customer-history-card').forEach(card => {
        card.addEventListener('dblclick', () => {
            const historyId = card.getAttribute('data-id');
            const history = data.find(item => item.id === parseInt(historyId));
            showHistoryEditModal(history);
        });
    });
}

function renderDesktopCustomerHistory(data) {
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

// 매출 데이터 조회
async function loadSalesData() {
    const viewType = document.getElementById('salesViewType').value;
    const startDate = document.getElementById('salesStartDate').value;
    const endDate = document.getElementById('salesEndDate').value;

    try {
        const response = await fetch(`/api/sales?viewType=${viewType}&startDate=${startDate}&endDate=${endDate}`);
        const data = await response.json();

        // 요약 정보 업데이트
        updateSalesSummary(data);

        // 정렬 적용해서 바로 렌더링
        renderSalesTable(data);
    } catch (error) {
        console.error('Error loading sales data:', error);
    }
}

// 매출관리 초기화
function initializeSalesPage() {
    // 오늘 날짜 기준으로 기본 날짜 설정
    const today = new Date();
    today.setHours(today.getHours() + 9); // UTC+9
    const endDate = today.toISOString().split('T')[0];
    
    // 시작일은 현재 월의 1일로 설정
    const startDate = `${endDate.substring(0, 7)}-01`;
    
    // 날짜 입력 필드에 기본값 설정
    document.getElementById('salesStartDate').value = startDate;
    document.getElementById('salesEndDate').value = endDate;

    // 정렬 설정 추가
    setupTableSorting('salesTableBody', 'sales');
    
    // 초기 데이터 로드
    loadSalesData();
}

// 이벤트 리스너 추가
document.getElementById('salesViewType').addEventListener('change', loadSalesData);
document.getElementById('salesStartDate').addEventListener('change', loadSalesData);
document.getElementById('salesEndDate').addEventListener('change', loadSalesData);


// 요약 정보 업데이트
function updateSalesSummary(data) {
    const totalSales = data.reduce((sum, item) => sum + item.total, 0);
    const totalCount = data.reduce((sum, item) => sum + item.count, 0);

    document.getElementById('totalSales').textContent = totalSales.toLocaleString() + '원';
    document.getElementById('totalCount').textContent = totalCount.toLocaleString() + '건';
}

// 테이블 렌더링
function renderSalesTable(data) {
    const tbody = document.getElementById('salesTableBody');
    const viewType = document.getElementById('salesViewType').value;

    // 정렬 적용
    const sortedData = sortData(
        data,
        sortState.sales.column,
        sortState.sales.direction
    );

    tbody.innerHTML = sortedData.map(item => {
        let displayPeriod = item.period;
        let periodClass = '';
        
        if (viewType === 'day') {
            const { formattedDate, dayClass } = formatDateWithDay(item.period);
            displayPeriod = formattedDate;
            periodClass = dayClass;
        }

        return `
            <tr>
                <td class="${periodClass}">${displayPeriod}</td>
                <td>${item.count.toLocaleString()} 건</td>
                <td class="alignRight">${item.total.toLocaleString()}</td>
            </tr>
        `;
    }).join('');
}

function formatDateWithDay(dateStr) {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const dayOfWeek = days[date.getDay()];
    
    // 요일별 스타일 클래스 결정
    let dayClass = '';
    if (date.getDay() === 0) { // 일요일
        dayClass = 'text-red-600';
    } else if (date.getDay() === 6) { // 토요일
        dayClass = 'text-blue-600';
    }
    
    return {
        formattedDate: `${year}-${month}-${day} (${dayOfWeek})`,
        dayClass: dayClass
    };
}

document.getElementById('downloadCsvBtn')?.addEventListener('click', async () => {
    try {
        const response = await fetch('/api/export/csv');
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'data.zip';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    } catch (error) {
        console.error('Error:', error);
        alert('CSV 다운로드에 실패했습니다.');
    }
});

// 로그아웃
document.getElementById('logoutBtn').addEventListener('click', () => {
    if(!confirm("로그아웃 하시겠습니까?")) {return;}
    sessionStorage.removeItem('isLoggedIn');
    window.location.href = '/';
});

document.getElementById('logoutBtn_Mobile').addEventListener('click', () => {
    fn_logout();
});

function fn_logout() {
    if(!confirm("로그아웃 하시겠습니까?")) {return;}
    sessionStorage.removeItem('isLoggedIn');
    window.location.href = '/';
}

function fn_doLogout() {
    sessionStorage.removeItem('isLoggedIn');
    window.location.href = '/';
}

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

// 모바일 네비게이션 관련 변수
const mobileNavItems = document.querySelectorAll('.mobile-nav-item');
const mobileMoreMenu = document.querySelector('.mobile-more-menu');
const adminMenu = document.querySelector('.mobile-more-menu .admin-menu');
let isMoreMenuOpen = false;

// 초기화 시 관리자 메뉴 표시 여부 설정
function initializeMobileNav() {
    const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
    adminMenu.classList.toggle('hidden', !isAdmin);
    
    // 현재 페이지에 해당하는 네비게이션 아이템 활성화
    const currentPage = getCurrentPage();
    updateMobileNavActive(currentPage);
}

// 모바일 네비게이션 클릭 이벤트
mobileNavItems.forEach(item => {
    item.addEventListener('click', () => {
        const pageId = item.getAttribute('data-page');
        
        if (pageId === 'more') {
            toggleMoreMenu();
        } else {
            isMoreMenuOpen = false;
            mobileMoreMenu.classList.remove('show');
            changePage(pageId);
            updateMobileNavActive(pageId);
        }
    });
});

// 더보기 메뉴 토글
function toggleMoreMenu() {
    isMoreMenuOpen = !isMoreMenuOpen;
    mobileMoreMenu.classList.toggle('show', isMoreMenuOpen);
}

// 모바일 네비게이션 활성화 상태 업데이트
function updateMobileNavActive(pageId) {
    mobileNavItems.forEach(item => {
        item.classList.toggle('active', item.getAttribute('data-page') === pageId);
    });
}

// 현재 페이지 ID 가져오기
function getCurrentPage() {
    const activePage = document.querySelector('.page:not(.hidden)');
    return activePage ? activePage.id.replace('-page', '') : 'main';
}

// 관리자 메뉴 클릭 이벤트
adminMenu.addEventListener('click', () => {
    changePage('admin');
    isMoreMenuOpen = false;
    mobileMoreMenu.classList.remove('show');
});

// 화면 크기 변경 시 더보기 메뉴 닫기
window.addEventListener('resize', () => {
    if (window.innerWidth > 768 && isMoreMenuOpen) {
        isMoreMenuOpen = false;
        mobileMoreMenu.classList.remove('show');
    }
});

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
    initializeMobileNav();
});

// 백업 설정 UI 요소
const backupSettingsForm = document.getElementById('backupSettingsForm');
const autoBackupSwitch = document.getElementById('autoBackup');
const backupInterval = document.getElementById('backupInterval');
const backupTime = document.getElementById('backupTime');
const backupDay = document.getElementById('backupDay');
const backupEmail = document.getElementById('backupEmail');
const weekDaySelect = document.getElementById('weekDaySelect');
const runBackupNow = document.getElementById('runBackupNow');

// 백업 주기에 따른 요일 선택 표시/숨김
backupInterval.addEventListener('change', () => {
    weekDaySelect.style.display = 
        backupInterval.value === 'weekly' ? 'block' : 'none';
});

// 백업 설정 관련 코드
async function loadBackupSettings() {
    try {
        const response = await fetch('/api/backup/settings');
        const settings = await response.json();
        
        // 설정값 UI에 적용
        document.getElementById('autoBackup').checked = settings.is_auto_backup;
        document.getElementById('backupInterval').value = settings.backup_interval;
        document.getElementById('backupTime').value = settings.backup_time;
        document.getElementById('backupDay').value = settings.backup_day;
        document.getElementById('backupEmail').value = settings.backup_email || '';

        // 백업 주기에 따른 요일 선택 UI 표시/숨김
        document.getElementById('weekDaySelect').style.display = 
            settings.backup_interval === 'weekly' ? 'block' : 'none';
    } catch (error) {
        console.error('백업 설정 로드 실패:', error);
        alert('백업 설정을 불러오는데 실패했습니다.');
    }
}

// 백업 설정 저장
document.getElementById('backupSettingsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const settings = {
        is_auto_backup: document.getElementById('autoBackup').checked,
        backup_interval: document.getElementById('backupInterval').value,
        backup_time: document.getElementById('backupTime').value,
        backup_day: document.getElementById('backupDay').value,
        backup_email: document.getElementById('backupEmail').value
    };

    try {
        const response = await fetch('/api/backup/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings)
        });

        if (response.ok) {
            alert('백업 설정이 저장되었습니다.');
        } else {
            throw new Error('설정 저장 실패');
        }
    } catch (error) {
        console.error('백업 설정 저장 실패:', error);
        alert('백업 설정 저장에 실패했습니다.');
    }
});

// 백업 주기 변경 시 요일 선택 UI 표시/숨김
document.getElementById('backupInterval').addEventListener('change', (e) => {
    document.getElementById('weekDaySelect').style.display = 
        e.target.value === 'weekly' ? 'block' : 'none';
});

// 수동 백업 실행
document.getElementById('runBackupNow').addEventListener('click', async () => {
    const email = document.getElementById('backupEmail').value;
    if (!email) {
        alert('백업 이메일 주소를 먼저 설정해주세요.');
        return;
    }

    try {
        const response = await fetch('/api/backup/run', {
            method: 'POST'
        });

        if (response.ok) {
            alert('백업 파일이 메일로 전송되었습니다. 메일을 확인해주세요.');
        } else {
            throw new Error('백업 실행 실패');
        }
    } catch (error) {
        console.error('백업 실행 실패:', error);
        alert('백업에 실패했습니다.');
    }
});

// 관리자 페이지 로드 시 백업 설정 로드
document.addEventListener('DOMContentLoaded', () => {
    // 기존 이벤트 리스너들...

    // 관리자 페이지 전환 시 백업 설정 로드
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const pageId = item.getAttribute('data-page');
            if (pageId === 'admin') {
                loadBackupSettings();
            }
        });
    });
});

// 모바일 네비게이션에서 관리자 메뉴 클릭 시에도 백업 설정 로드
document.querySelector('.admin-menu')?.addEventListener('click', () => {
    loadBackupSettings();
});

// 초기 데이터 로드
loadCustomers();
loadServices();
setTodayDate();  // 날짜 먼저 설정
loadHistory();
initializeSalesPage();  // 매출관리 초기화 추가