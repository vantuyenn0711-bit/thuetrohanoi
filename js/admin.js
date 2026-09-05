// ==========================================================================
// ADMIN DASHBOARD LOGIC - ĐẶNG VĂN TUYỂN (0358954360)
// ==========================================================================
const STORAGE_ROOMS_KEY = "thuetro_rooms_v20";
const STORAGE_BOOKINGS_KEY = "thuetro_bookings_list";

const SOURCE_GROUP_NAMES = {
  "nguon-ba-dinh": "Ba Đình - Tây Hồ",
  "nguon-ba-dinh-tay-ho": "Ba Đình - Tây Hồ",
  "nguon-cau-dien": "Cầu Diễn",
  "nguon-cau-giay": "Cầu Giấy",
  "nguon-xuan-dinh": "Cổ Nhuế , Xuân Đỉnh",
  "nguon-co-nhue-xuan-dinh": "Cổ Nhuế , Xuân Đỉnh",
  "nguon-dinh-cong": "Định Công",
  "nguon-dong-da": "Đống Đa",
  "nguon-ha-dong": "Hà Đông",
  "nguon-ho-tung-mau": "Hồ Tùng Mậu",
  "nguon-hoai-duc": "Hoài Đức",
  "nguon-hoang-mai": "Hoàng Mai",
  "nguon-kim-giang-ngoc-hoi": "Kim Giang, Ngọc Hồi",
  "me-tri-phu-do": "Mễ Trì - Phú Đô",
  "nguon-me-tri-phu-do": "Mễ Trì - Phú Đô",
  "nguon-my-dinh": "Mỹ Đình",
  "nguon-nam-tu-liem": "Nam Từ Liêm",
  "nguon-phu-dien": "Phú Diễn",
  "nguon-tay-ho": "Tây Hồ",
  "nguon-thanh-xuan": "Thanh Xuân",
  "nguon-trieu-khuc": "Triều Khúc",
  "nguon-xuan-phuong": "Xuân Phương",
  "nguon-yen-xa-mau-luong": "Yên Xá/Mậu Lương",
  "ngoc-truc-dai-linh": "Ngọc Trục - Đại Linh"
};

let adminRooms = [];
let adminBookings = [];

document.addEventListener("DOMContentLoaded", () => {
  loadAdminData();
  renderAdminStats();
  renderBookingsTable();
  renderRoomsTable();
});

function transformMoithueName(str) {
  if (!str) return '';
  let clean = str.trim();

  // 1. Chuyển số đầu có dấu chấm (649.x, 649.55.x, 467.170.x, 139.49.X, 259.x, 448.x...) thành "Ngõ 649 "
  clean = clean.replace(/^(?:(?:ngõ|Ngõ)\s+)?(\d+)(?:\.[a-zA-Z0-9_\-]+)+\s*/i, (match, alley) => {
    return `Ngõ ${alley} `;
  });

  // Đảm bảo dấu ngoặc có khoảng trắng phía trước nếu dính chữ (vd: Lĩnh Nam(1) -> Lĩnh Nam (1))
  clean = clean.replace(/([^\s(])\(/g, '$1 (');

  // Xóa dấu ngoặc mở cụt ở cuối chuỗi (vd: 259.x Vĩnh Hưng( -> 259.x Vĩnh Hưng)
  clean = clean.replace(/\(\s*$/, '').trim();

  // 2. Trích xuất và bảo toàn phần "_Trục XX" nếu có
  let trucPart = '';
  const trucMatch = clean.match(/(?:_|\s)(Trục\s*\d+[a-zA-Z0-9\-]*)/i);
  if (trucMatch) {
    trucPart = '_' + trucMatch[1].replace(/\s+/g, ' ').trim();
    // Tách phần tên trước Trục
    const idx = clean.search(/(?:_|\s)Trục\s*\d+/i);
    if (idx > -1) {
      clean = clean.substring(0, idx).trim();
    }
  } else {
    // Nếu không có Trục, cắt bỏ các mã nhân viên / hậu tố sau dấu _ (vd: _A Tâm, _A Nhu, _A Đạt, _FH, _LN...)
    clean = clean.replace(/_(?:A|Anh|Chị|Em|C|E|FH|LN|AK|MK|HL|HN|QD|CD|T\d+|[A-Z]{2,4})[\s\S]*$/i, '').trim();
  }

  // Loại bỏ các mã đuôi thừa nếu còn dính vào tên chính trước Trục
  clean = clean.replace(/_(?:A|Anh|Chị|Em|C|E|FH|LN|AK|MK|HL|HN|QD|CD|T\d+|[A-Z]{2,4})[\s\S]*$/i, '').trim();
  clean = clean.replace(/_+$/, '').trim();

  // Ghép lại phần Trục
  if (trucPart) {
    clean = clean + trucPart;
  }

  // Chuẩn hóa khoảng trắng
  return clean.replace(/\s+/g, ' ').trim();
}

function loadAdminData() {
  const savedRooms = localStorage.getItem(STORAGE_ROOMS_KEY);
  if (savedRooms !== null) {
    try { 
      adminRooms = JSON.parse(savedRooms).map(r => {
        if (r.title) r.title = transformMoithueName(r.title);
        if (r.address) r.address = transformMoithueName(r.address);
        return r;
      }); 
    } catch (e) { adminRooms = []; }
  } else {
    adminRooms = [];
    fetch('/api/rooms')
      .then(res => res.json())
      .then(data => {
        adminRooms = Array.isArray(data) ? data.map(r => {
          if (r.title) r.title = transformMoithueName(r.title);
          if (r.address) r.address = transformMoithueName(r.address);
          return r;
        }) : [];
        try { localStorage.setItem(STORAGE_ROOMS_KEY, JSON.stringify(adminRooms)); } catch(e) {}
        renderAdminStats();
        renderRoomsTable();
      })
      .catch(() => {});
  }

  const savedBookings = localStorage.getItem(STORAGE_BOOKINGS_KEY);
  if (savedBookings) {
    try { adminBookings = JSON.parse(savedBookings); } catch (e) { adminBookings = []; }
  } else {
    adminBookings = [];
  }
}

function clearAllRooms() {
  if (!confirm("⚠️ Bạn có chắc chắn muốn xóa TẤT CẢ phòng hiện có? Toàn bộ danh sách sẽ được đưa về 0 phòng.")) return;
  adminRooms = [];
  localStorage.setItem(STORAGE_ROOMS_KEY, JSON.stringify([]));
  fetch('/api/save-rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([])
  }).catch(e => console.warn('Could not persist to server', e));

  renderAdminStats();
  renderRoomsTable();
  showToast("🗑️ Đã xóa toàn bộ phòng! Hệ thống đang có 0 phòng.");
}

function renderAdminStats() {
  const totalRoomsEl = document.getElementById("statTotalRooms");
  const availableRoomsEl = document.getElementById("statAvailableRooms");
  const rentedRoomsEl = document.getElementById("statRentedRooms");

  const availableCount = adminRooms.filter(r => r.status === "available").length;
  const rentedCount = adminRooms.filter(r => r.status === "rented").length;

  if (totalRoomsEl) totalRoomsEl.innerText = adminRooms.length;
  if (availableRoomsEl) availableRoomsEl.innerText = availableCount;
  if (rentedRoomsEl) rentedRoomsEl.innerText = rentedCount;
  
  // Update dynamic labels
  const totalLabel = document.getElementById('adminTotalRoomsLabel');
  if (totalLabel) totalLabel.innerText = adminRooms.length;
}

// ==========================================================================
// RENDER BOOKINGS TABLE
// ==========================================================================
function renderBookingsTable() {
  const tableBody = document.getElementById("bookingsTableBody");
  if (!tableBody) return;

  if (adminBookings.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 40px; color: var(--text-muted);">
          <i class="far fa-calendar-times" style="font-size: 2rem; margin-bottom: 8px;"></i>
          <div>Chưa có lịch hẹn nào từ khách hàng.</div>
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = adminBookings.map(b => {
    let statusClass = "background: #FEF3C7; color: #B45309;";
    if (b.status === "Đã hẹn xem") statusClass = "background: #DBEAFE; color: #1E40AF;";
    if (b.status === "Đã cọc" || b.status === "Đã xem phòng") statusClass = "background: #D1FAE5; color: #065F46;";
    if (b.status === "Hủy") statusClass = "background: #FEE2E2; color: #991B1B;";

    return `
      <tr>
        <td>
          <strong style="color: var(--dark);">${b.customerName}</strong>
          <div style="font-size: 0.8rem; color: var(--text-muted);">${b.createdAt}</div>
        </td>
        <td>
          <div style="font-weight: 700; color: var(--primary);">${b.customerPhone}</div>
          <div style="display: flex; gap: 6px; margin-top: 4px;">
            <a href="tel:${b.customerPhone}" style="color: var(--success); font-size: 0.85rem; font-weight: 600;" title="Gọi ngay cho khách">
              <i class="fas fa-phone-alt"></i> Gọi
            </a>
            <a href="https://zalo.me/${b.customerPhone}" target="_blank" style="color: #0068FF; font-size: 0.85rem; font-weight: 600;" title="Nhắn Zalo">
              <i class="fas fa-comment-dots"></i> Zalo
            </a>
          </div>
        </td>
        <td>
          <div style="font-weight: 600; color: var(--dark);">${b.roomTitle}</div>
          <div style="font-size: 0.8rem; color: var(--text-muted);">${b.roomAddress}</div>
        </td>
        <td>
          <strong>${b.bookDate}</strong>
          <div style="font-size: 0.82rem; color: var(--text-muted);">${b.bookTime}</div>
          <div style="font-size: 0.78rem; color: var(--primary);">(${b.peopleCount} người)</div>
        </td>
        <td>
          <div style="font-size: 0.85rem; max-width: 200px; color: var(--text-main); font-style: italic;">
            "${b.note || 'Không có ghi chú'}"
          </div>
        </td>
        <td>
          <select onchange="updateBookingStatus('${b.id}', this.value)" style="padding: 6px 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); font-weight: 700; font-size: 0.82rem; ${statusClass}">
            <option value="Chờ xác nhận" ${b.status === 'Chờ xác nhận' ? 'selected' : ''}>Chờ xác nhận</option>
            <option value="Đã hẹn xem" ${b.status === 'Đã hẹn xem' ? 'selected' : ''}>Đã hẹn xem</option>
            <option value="Đã xem phòng" ${b.status === 'Đã xem phòng' ? 'selected' : ''}>Đã xem phòng</option>
            <option value="Đã cọc" ${b.status === 'Đã cọc' ? 'selected' : ''}>Đã cọc phòng</option>
            <option value="Hủy" ${b.status === 'Hủy' ? 'selected' : ''}>Hủy hẹn</option>
          </select>
        </td>
        <td>
          <button onclick="deleteBooking('${b.id}')" style="background: none; border: none; color: var(--danger); cursor: pointer; padding: 6px;" title="Xóa lịch hẹn">
            <i class="fas fa-trash-alt"></i>
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

function updateBookingStatus(bookingId, newStatus) {
  const item = adminBookings.find(b => b.id === bookingId);
  if (item) {
    item.status = newStatus;
    localStorage.setItem(STORAGE_BOOKINGS_KEY, JSON.stringify(adminBookings));
    renderAdminStats();
    renderBookingsTable();
    showToast("Đã cập nhật trạng thái lịch hẹn!");
  }
}

function deleteBooking(bookingId) {
  if (!confirm("Bạn có chắc chắn muốn xóa lịch hẹn này không?")) return;
  adminBookings = adminBookings.filter(b => b.id !== bookingId);
  localStorage.setItem(STORAGE_BOOKINGS_KEY, JSON.stringify(adminBookings));
  renderAdminStats();
  renderBookingsTable();
  showToast("Đã xóa lịch hẹn!");
}

// ==========================================================================
// RENDER ROOMS TABLE & MANAGEMENT WITH SEARCH, FILTER, TOGGLE & PAGINATION
// ==========================================================================
let adminCurrentPage = 1;
const adminPageSize = 25;

function onAdminFilterChange() {
  adminCurrentPage = 1;
  renderRoomsTable();
}

function getFilteredAdminRooms() {
  const searchInput = document.getElementById("adminRoomSearch");
  const statusSelect = document.getElementById("adminStatusFilter");
  const districtSelect = document.getElementById("adminDistrictFilter");
  const sourceGroupSelect = document.getElementById("adminSourceGroupFilter");

  const query = searchInput ? searchInput.value.trim().toLowerCase() : "";
  const status = statusSelect ? statusSelect.value : "all";
  const district = districtSelect ? districtSelect.value : "all";
  const sourceGroup = sourceGroupSelect ? sourceGroupSelect.value : "all";

  return adminRooms.filter(r => {
    if (status !== "all" && r.status !== status) return false;
    if (district !== "all") {
      const d = district.replace(/^(quan-|huyen-)/, '');
      const rd = (r.district || '').replace(/^(quan-|huyen-)/, '');
      if (d !== rd) return false;
    }
    if (sourceGroup !== "all" && r.sourceGroup !== sourceGroup) return false;
    if (query) {
      const matchTitle = (r.title || "").toLowerCase().includes(query);
      const matchAddress = (r.address || "").toLowerCase().includes(query);
      const matchId = (r.id || "").toLowerCase().includes(query);
      if (!matchTitle && !matchAddress && !matchId) return false;
    }
    return true;
  });
}

function renderRoomsTable() {
  const tableBody = document.getElementById("roomsTableBody");
  if (!tableBody) return;

  const filtered = getFilteredAdminRooms();
  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / adminPageSize) || 1;

  if (adminCurrentPage > totalPages) adminCurrentPage = totalPages;
  if (adminCurrentPage < 1) adminCurrentPage = 1;

  const startIndex = (adminCurrentPage - 1) * adminPageSize;
  const pageItems = filtered.slice(startIndex, startIndex + adminPageSize);

  // Update badge count
  const countBadge = document.getElementById("adminRoomsCountBadge");
  if (countBadge) {
    countBadge.innerText = `${totalItems} / ${adminRooms.length} phòng`;
  }

  if (pageItems.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 40px; color: var(--text-muted);">
          <i class="fas fa-search" style="font-size: 2rem; margin-bottom: 8px;"></i>
          <div>Không tìm thấy phòng trọ nào phù hợp với bộ lọc.</div>
        </td>
      </tr>
    `;
    renderAdminPagination(0, 1);
    return;
  }

  tableBody.innerHTML = pageItems.map(r => {
    const isAvailable = r.status === "available";
    const statusBg = isAvailable ? "#DCFCE7" : "#FEE2E2";
    const statusColor = isAvailable ? "#15803D" : "#B91C1C";
    const statusBorder = isAvailable ? "#86EFAC" : "#FCA5A5";
    const statusIcon = isAvailable ? "fa-check-circle" : "fa-times-circle";
    const statusText = isAvailable ? "Còn phòng" : "Hết phòng";
    const sourceLabel = r.sourceGroupName || SOURCE_GROUP_NAMES[r.sourceGroup] || r.sourceGroup || "";

    return `
      <tr>
        <td>
          <img src="${r.images[0]}" style="width: 60px; height: 48px; object-fit: cover; border-radius: var(--radius-sm);" alt="${r.title}" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80'">
        </td>
        <td>
          <span class="badge-code" style="background: var(--primary);">${r.tag || r.categoryName}</span>
        </td>
        <td>
          <strong style="color: var(--dark); font-size: 0.95rem;">${r.title}</strong>
          <div style="font-size: 0.8rem; color: var(--text-muted);">${r.address}</div>
          ${sourceLabel ? `<div style="font-size: 0.76rem; color: var(--primary); font-weight: 600; margin-top: 3px;"><i class="fas fa-compass"></i> ${sourceLabel}</div>` : ''}
        </td>
        <td>
          <span style="font-weight: 700; color: var(--accent);">${new Intl.NumberFormat('vi-VN').format(r.price)} đ</span>
        </td>
        <td>${r.area} m²</td>
        <td>
          <button onclick="toggleRoomStatus('${r.id}')" style="background: ${statusBg}; color: ${statusColor}; border: 1px solid ${statusBorder}; padding: 6px 14px; border-radius: 20px; font-weight: 700; font-size: 0.82rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;" title="Bấm vào để đổi trạng thái nhanh Còn phòng / Hết phòng">
            <i class="fas ${statusIcon}"></i>
            <span>${statusText}</span>
          </button>
        </td>
        <td>
          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            <button onclick="window.open('index.html?room=${r.id}', '_blank')" style="background: #EFF6FF; border: 1px solid #BFDBFE; color: #1D4ED8; padding: 6px 10px; border-radius: var(--radius-sm); cursor: pointer; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;" title="Mở xem phòng này trên giao diện người dùng">
              <i class="fas fa-external-link-alt"></i> Xem
            </button>
            <button onclick="editRoomModal('${r.id}')" style="background: var(--bg-alt); border: 1px solid var(--border-color); padding: 6px 10px; border-radius: var(--radius-sm); cursor: pointer;" title="Chỉnh sửa chi tiết phòng">
              <i class="fas fa-edit" style="color: var(--secondary);"></i> Sửa
            </button>
            <button onclick="deleteRoom('${r.id}')" style="background: var(--bg-alt); border: 1px solid var(--border-color); padding: 6px 10px; border-radius: var(--radius-sm); cursor: pointer;" title="Xóa phòng này">
              <i class="fas fa-trash-alt" style="color: var(--danger);"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  renderAdminPagination(totalItems, totalPages);
}

function renderAdminPagination(totalItems, totalPages) {
  const paginationEl = document.getElementById("adminPagination");
  if (!paginationEl) return;

  if (totalPages <= 1) {
    paginationEl.innerHTML = `<div style="font-size: 0.88rem; color: var(--text-muted);">Hiển thị toàn bộ ${totalItems} phòng</div>`;
    return;
  }

  const start = (adminCurrentPage - 1) * adminPageSize + 1;
  const end = Math.min(adminCurrentPage * adminPageSize, totalItems);

  paginationEl.innerHTML = `
    <div style="font-size: 0.88rem; color: var(--text-muted);">
      Hiển thị <strong>${start} - ${end}</strong> trong tổng số <strong>${totalItems}</strong> phòng (Trang ${adminCurrentPage}/${totalPages})
    </div>
    <div style="display: flex; gap: 6px; align-items: center;">
      <button onclick="changeAdminPage(1)" ${adminCurrentPage === 1 ? 'disabled style="opacity: 0.5;"' : ''} style="padding: 6px 12px; border: 1px solid var(--border-color); background: white; border-radius: 4px; cursor: pointer;">
        <i class="fas fa-angle-double-left"></i>
      </button>
      <button onclick="changeAdminPage(${adminCurrentPage - 1})" ${adminCurrentPage === 1 ? 'disabled style="opacity: 0.5;"' : ''} style="padding: 6px 12px; border: 1px solid var(--border-color); background: white; border-radius: 4px; cursor: pointer;">
        <i class="fas fa-chevron-left"></i> Trước
      </button>
      <span style="font-weight: 700; padding: 0 8px; color: var(--primary);">Trang ${adminCurrentPage}</span>
      <button onclick="changeAdminPage(${adminCurrentPage + 1})" ${adminCurrentPage === totalPages ? 'disabled style="opacity: 0.5;"' : ''} style="padding: 6px 12px; border: 1px solid var(--border-color); background: white; border-radius: 4px; cursor: pointer;">
        Sau <i class="fas fa-chevron-right"></i>
      </button>
      <button onclick="changeAdminPage(${totalPages})" ${adminCurrentPage === totalPages ? 'disabled style="opacity: 0.5;"' : ''} style="padding: 6px 12px; border: 1px solid var(--border-color); background: white; border-radius: 4px; cursor: pointer;">
        <i class="fas fa-angle-double-right"></i>
      </button>
    </div>
  `;
}

function changeAdminPage(newPage) {
  adminCurrentPage = newPage;
  renderRoomsTable();
  const table = document.querySelector(".data-table");
  if (table) table.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ======================================================================
// SYNC ROOMS DATA TO SERVER & LOCALSTORAGE
// ======================================================================
async function syncAdminRoomsToServer() {
  try {
    localStorage.setItem(STORAGE_ROOMS_KEY, JSON.stringify(adminRooms));
  } catch (e) {}

  try {
    const res = await fetch('/api/save-rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(adminRooms)
    });
    if (!res.ok) {
      await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adminRooms)
      });
    }
  } catch (err) {
    console.error('Không thể lưu lên server:', err);
  }
}

async function toggleRoomStatus(roomId) {
  const room = adminRooms.find(r => r.id === roomId);
  if (!room) return;

  const newStatus = room.status === "available" ? "rented" : "available";
  room.status = newStatus;
  room.statusName = newStatus === "available" ? "Còn phòng" : "Đã cho thuê";

  renderAdminStats();
  renderRoomsTable();
  await syncAdminRoomsToServer();
  showToast(newStatus === "available" ? "🟢 Đã chuyển phòng sang: CÒN PHÒNG" : "🔴 Đã chuyển phòng sang: HẾT PHÒNG (Đã cho thuê)");
}

async function updateRoomStatus(roomId, newStatus) {
  const room = adminRooms.find(r => r.id === roomId);
  if (room) {
    room.status = newStatus;
    room.statusName = newStatus === "available" ? "Còn phòng" : "Đã cho thuê";
    renderAdminStats();
    renderRoomsTable();
    await syncAdminRoomsToServer();
    showToast("Đã cập nhật trạng thái phòng!");
  }
}

async function deleteRoom(roomId) {
  if (!confirm("Bạn có chắc chắn muốn xóa phòng này khỏi website?")) return;
  adminRooms = adminRooms.filter(r => r.id !== roomId);
  renderAdminStats();
  renderRoomsTable();
  await syncAdminRoomsToServer();
  showToast("Đã xóa phòng trọ!");
}

async function clearAllRooms() {
  if (!confirm("CẢNH BÁO: Bạn có chắc chắn muốn xóa toàn bộ danh sách phòng về 0 phòng?")) return;
  adminRooms = [];
  renderAdminStats();
  renderRoomsTable();
  await syncAdminRoomsToServer();
  showToast("Đã xóa sạch toàn bộ phòng về 0!");
}

// ==========================================================================
// ENTERPRISE ADD & EDIT ROOM MODAL LOGIC (5 TABS ĐA LUỒNG)
// ==========================================================================
let editingRoomId = null;

function switchFormTab(tabId, btn) {
  document.querySelectorAll('.form-tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.form-tab-pane').forEach(p => p.style.display = 'none');

  if (btn) btn.classList.add('active');
  const targetPane = document.getElementById(tabId);
  if (targetPane) targetPane.style.display = 'block';
}

function renderFormImageThumbnails() {
  const textarea = document.getElementById("formImagesList");
  const previewBox = document.getElementById("formImageThumbnailsPreview");
  if (!textarea || !previewBox) return;

  const lines = textarea.value.split("\n").map(l => l.trim()).filter(l => l.startsWith("http"));
  if (lines.length === 0) {
    previewBox.innerHTML = `<span style="color: var(--text-muted); font-size: 0.85rem;">Nhập link ảnh phía trên để xem trước tại đây.</span>`;
    return;
  }

  previewBox.innerHTML = lines.map((url, idx) => `
    <div style="position: relative; width: 75px; height: 60px; border-radius: 4px; overflow: hidden; border: 2px solid ${idx === 0 ? 'var(--primary)' : 'var(--border-color)'};">
      <img src="${url}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80'">
      ${idx === 0 ? '<span style="position: absolute; bottom: 0; left: 0; right: 0; background: rgba(13,148,136,0.9); color: white; font-size: 8px; text-align: center; font-weight: 700;">Ảnh bìa</span>' : ''}
    </div>
  `).join("");
}

function openAddRoomModal() {
  editingRoomId = null;
  document.getElementById("roomFormModalTitle").innerText = "Đăng Thêm Phòng Trọ Mới";
  document.getElementById("roomFormModalSubtitle").innerText = "Nhập đầy đủ thông tin phòng theo 5 luồng bên dưới";
  document.getElementById("roomFormBadgeId").innerText = "MT-NEW";
  document.getElementById("roomManageForm").reset();

  // Switch to Tab 1
  const firstTabBtn = document.querySelector('.form-tab-btn');
  switchFormTab('form-tab-basic', firstTabBtn);

  // Set default values
  document.getElementById("formRoomTag").value = "Khép kín Studio";
  document.getElementById("formFloor").value = "Tầng 3 / 6 tầng (Thang máy)";
  document.getElementById("formMaxPeople").value = 2;
  document.getElementById("formMaxVehicles").value = 2;
  document.getElementById("formPrice").value = 4500000;
  document.getElementById("formArea").value = 28;
  document.getElementById("formMoveInStatus").value = "Ở ngay";
  document.getElementById("formAvailableFloors").value = "Tầng 3";
  document.getElementById("formPhone").value = "0358954360";
  document.getElementById("formContactPerson").value = "Đặng Văn Tuyển";
  document.getElementById("formImagesList").value = "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80\nhttps://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80";
  
  // Default description
  const descEl = document.getElementById("formDescription");
  if (descEl) {
    descEl.value = "THÔNG TIN PHÒNG\nĐỊA CHỈ: ...\n🍡 Diện tích: 28m2\n🍡 Thang máy: Có\n🍡 Dạng phòng: Studio\n🛋️ Nội thất: Điều hòa, nóng lạnh, giường tủ, tủ lạnh, bếp, hút mùi.\n✅ TIỆN ÍCH\n• Gần đường lớn, tiện xe bus & di chuyển.\n• Gần chợ, siêu thị dân sinh sầm uất.\n• Khu an ninh cao, dân trí tốt.\n🚚 DỊCH VỤ\n• Điện: 4k/số\n• Nước: 35k/khối\n• Internet: 100k/phòng\n• Dịch vụ chung: 200k/người\n• Xe máy: Free 2 xe\n❎ LƯU Ý\n• Tối đa: 2 người 2 xe\n• Xe điện: Có nhận xe điện\n• Nuôi pet: Không\n• Giờ giấc: Tự do 24/7\n• Không chung chủ\n• Hợp đồng: 12 tháng\n• Thanh toán: Đóng 1 cọc 1";
  }

  // Check default amenities
  document.querySelectorAll(".form-amenity-cb").forEach(cb => {
    cb.checked = ["Điều hòa", "Nóng lạnh", "Giường đệm", "Tủ quần áo", "Tủ lạnh"].includes(cb.value);
  });

  const evPolicyEl = document.getElementById("formElectricVehiclePolicy");
  if (evPolicyEl) evPolicyEl.value = "allowed";

  renderFormImageThumbnails();
  openModal("roomManageModal");
}

function editRoomModal(roomId) {
  const room = adminRooms.find(r => r.id === roomId);
  if (!room) return;
  editingRoomId = roomId;

  document.getElementById("roomFormModalTitle").innerText = "Chỉnh Sửa Chi Tiết Phòng Trọ";
  document.getElementById("roomFormModalSubtitle").innerText = `Đang sửa phòng: ${room.title}`;
  document.getElementById("roomFormBadgeId").innerText = room.id;

  // Switch to Tab 1
  const firstTabBtn = document.querySelector('.form-tab-btn');
  switchFormTab('form-tab-basic', firstTabBtn);

  // Tab 1: Basic
  document.getElementById("formRoomTitle").value = room.title || "";
  document.getElementById("formAddress").value = room.address || "";
  document.getElementById("formDistrict").value = room.district || "cau-giay";
  document.getElementById("formSourceGroup").value = room.sourceGroup || "nguon-cau-giay";
  document.getElementById("formRoomLayout").value = room.roomLayout || "STUDIO";
  document.getElementById("formStatus").value = room.status || "available";
  document.getElementById("formRoomTag").value = room.tag || room.categoryName || "Khép kín";

  // Tab 2: Specs
  document.getElementById("formPrice").value = room.price || 0;
  document.getElementById("formArea").value = room.area || 0;
  document.getElementById("formFloor").value = room.floor || "";
  document.getElementById("formElevator").value = room.elevator !== false ? "true" : "false";
  document.getElementById("formMaxPeople").value = room.maxPeople || 2;
  document.getElementById("formMaxVehicles").value = room.maxVehicles || 2;
  document.getElementById("formMoveInStatus").value = room.moveInStatus || "Ở ngay";
  document.getElementById("formAvailableFloors").value = (room.availableFloors || []).join(", ");

  // Tab 3: Full Description
  const descEl = document.getElementById("formDescription");
  if (descEl) {
    descEl.value = room.description || "";
  }

  // Tab 4: Filter checkboxes & amenities
  document.getElementById("formPetAllowed").checked = !!room.petAllowed;
  const evPolicyEl = document.getElementById("formElectricVehiclePolicy");
  if (evPolicyEl) {
    evPolicyEl.value = room.electricVehiclePolicy || (room.electricVehicle ? "allowed" : "forbidden");
  }
  document.getElementById("formForeignGuest").checked = !!room.foreignGuest;
  document.getElementById("formNearParking").checked = !!room.nearParking;
  document.getElementById("formNearMainRoad").checked = !!room.nearMainRoad;
  document.getElementById("formHasLoft").checked = !!room.loft;

  const amenities = room.amenities || [];
  document.querySelectorAll(".form-amenity-cb").forEach(cb => {
    cb.checked = amenities.includes(cb.value);
  });

  // Tab 5: Media
  const images = room.images || [];
  document.getElementById("formImagesList").value = images.join("\n");
  document.getElementById("formVideoUrl").value = room.videoUrl || "";
  document.getElementById("formPhone").value = room.phone || "0358954360";
  document.getElementById("formContactPerson").value = room.contactPerson || "Đặng Văn Tuyển";

  renderFormImageThumbnails();
  openModal("roomManageModal");
}

async function handleRoomFormSubmit(event) {
  event.preventDefault();

  // Tab 1
  const title = transformMoithueName(document.getElementById("formRoomTitle").value.trim());
  const address = transformMoithueName(document.getElementById("formAddress").value.trim());
  const district = document.getElementById("formDistrict").value;
  const sourceGroup = document.getElementById("formSourceGroup").value;
  const roomLayout = document.getElementById("formRoomLayout").value;
  const status = document.getElementById("formStatus").value;
  const tag = document.getElementById("formRoomTag").value.trim() || roomLayout;

  // Tab 2
  const price = parseInt(document.getElementById("formPrice").value) || 0;
  const area = parseInt(document.getElementById("formArea").value) || 0;
  const floor = document.getElementById("formFloor").value.trim() || "Tầng 2";
  const elevator = document.getElementById("formElevator").value === "true";
  const maxPeople = parseInt(document.getElementById("formMaxPeople").value) || 2;
  const maxVehicles = parseInt(document.getElementById("formMaxVehicles").value) || 2;
  const moveInStatus = document.getElementById("formMoveInStatus").value;
  const availableFloorsStr = document.getElementById("formAvailableFloors").value.trim();
  const availableFloors = availableFloorsStr ? availableFloorsStr.split(",").map(f => f.trim()).filter(Boolean) : [];

  // Tab 3: Description
  const descInputEl = document.getElementById("formDescription");
  const rawDescription = descInputEl ? descInputEl.value.trim() : "";
  const description = rawDescription || `Phòng trọ, căn hộ khép kín ${categoryName} tại ${address}. Đầy đủ nội thất, giờ giấc tự do, an ninh tốt.`;

  // Tab 4
  const petAllowed = document.getElementById("formPetAllowed").checked;
  const evPolicySelect = document.getElementById("formElectricVehiclePolicy");
  const electricVehiclePolicy = evPolicySelect ? evPolicySelect.value : "allowed";
  const electricVehicle = (electricVehiclePolicy === "allowed" || electricVehiclePolicy === "vinfast_only");
  const foreignGuest = document.getElementById("formForeignGuest").checked;
  const nearParking = document.getElementById("formNearParking").checked;
  const nearMainRoad = document.getElementById("formNearMainRoad").checked;
  const loft = document.getElementById("formHasLoft").checked;

  const amenities = Array.from(document.querySelectorAll(".form-amenity-cb:checked")).map(cb => cb.value);

  // Tab 5
  const imagesText = document.getElementById("formImagesList").value.trim();
  let images = imagesText.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  if (images.length === 0) {
    images = ["https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80"];
  }
  const videoUrl = document.getElementById("formVideoUrl").value.trim();
  const phone = document.getElementById("formPhone").value.trim() || "0358954360";
  const contactPerson = document.getElementById("formContactPerson").value.trim() || "Đặng Văn Tuyển";

  const categoryName = roomLayout === "STUDIO" ? "Khép kín (Studio)" : `Khép kín (${roomLayout})`;
  const statusName = status === "available" ? "Còn phòng" : "Đã cho thuê";

  if (editingRoomId) {
    const room = adminRooms.find(r => r.id === editingRoomId);
    if (room) {
      room.title = title;
      room.address = address;
      room.district = district;
      room.sourceGroup = sourceGroup;
      room.sourceGroupName = SOURCE_GROUP_NAMES[sourceGroup] || sourceGroup;
      room.roomLayout = roomLayout;
      room.categoryName = categoryName;
      room.tag = tag;
      room.status = status;
      room.statusName = statusName;
      room.price = price;
      room.area = area;
      room.floor = floor;
      room.elevator = elevator;
      room.maxPeople = maxPeople;
      room.maxVehicles = maxVehicles;
      room.moveInStatus = moveInStatus;
      room.availableFloors = availableFloors;
      room.description = description;
      room.petAllowed = petAllowed;
      room.electricVehiclePolicy = electricVehiclePolicy;
      room.electricVehicle = electricVehicle;
      room.foreignGuest = foreignGuest;
      room.nearParking = nearParking;
      room.nearMainRoad = nearMainRoad;
      room.loft = loft;
      room.amenities = amenities;
      room.images = images;
      room.videoUrl = videoUrl;
      room.phone = phone;
      room.contactPerson = contactPerson;
      room.description = description;
    }
    showToast("✅ Đã cập nhật thành công chi tiết phòng trọ!");
  } else {
    const newRoom = {
      id: "MT-ROOM-" + Date.now(),
      title,
      address,
      district,
      sourceGroup,
      sourceGroupName: SOURCE_GROUP_NAMES[sourceGroup] || sourceGroup,
      roomLayout,
      categoryName,
      tag,
      status,
      statusName,
      price,
      area,
      floor,
      elevator,
      maxPeople,
      maxVehicles,
      moveInStatus,
      availableFloors,
      detailDescription: { info, amenity, service, note },
      petAllowed,
      electricVehiclePolicy,
      electricVehicle,
      foreignGuest,
      nearParking,
      nearMainRoad,
      loft,
      amenities,
      images,
      videoUrl,
      phone,
      contactPerson,
      description,
      featured: false,
      views: 1,
      createdAt: new Date().toISOString()
    };
    adminRooms.unshift(newRoom);
    showToast("🎉 Đã thêm phòng trọ mới thành công!");
  }

  await syncAdminRoomsToServer();
  closeModal("roomManageModal");
  renderAdminStats();
  renderRoomsTable();
}

// ==========================================================================
// EXPORT & IMPORT BACKUP DATABASE (JSON)
// ==========================================================================
function exportRoomsJson() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(adminRooms, null, 2));
  const downloadAnchor = document.createElement("a");
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `thuetro_database_${adminRooms.length}_phong_${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast(`📁 Đã xuất dữ liệu ${adminRooms.length} phòng ra file JSON thành công!`);
}

function triggerImportJson() {
  const fileInput = document.getElementById("jsonFileInput");
  if (fileInput) fileInput.click();
}

function handleImportJson(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function(e) {
    try {
      const imported = JSON.parse(e.target.result);
      if (Array.isArray(imported) && imported.length > 0 && imported[0].title) {
        if (confirm(`Bạn có chắc muốn nhập ${imported.length} phòng từ file này vào hệ thống không? Dữ liệu hiện tại sẽ được cập nhật.`)) {
          adminRooms = imported;
          await syncAdminRoomsToServer();
          renderAdminStats();
          renderRoomsTable();
          showToast(`🎉 Đã nạp thành công ${imported.length} phòng vào hệ thống!`);
        }
      } else {
        alert("File JSON không hợp lệ hoặc không đúng định dạng danh sách phòng!");
      }
    } catch (err) {
      alert("Lỗi đọc file JSON: " + err.message);
    }
    event.target.value = "";
  };
  reader.readAsText(file);
}

function restoreInitialData() {
  if (!confirm(`Khôi phục lại danh sách ${INITIAL_ROOMS.length} phòng trọ gốc mặc định? Các phòng thêm mới hoặc chỉnh sửa gần đây sẽ được đưa về dữ liệu gốc ban đầu.`)) return;
  adminRooms = [...INITIAL_ROOMS];
  localStorage.setItem(STORAGE_ROOMS_KEY, JSON.stringify(adminRooms));
  renderAdminStats();
  renderRoomsTable();
  showToast(`Đã khôi phục toàn bộ ${INITIAL_ROOMS.length} phòng gốc thành công!`);
}

// ==========================================================================
// SYNC FROM MOITHUE.COM
// ==========================================================================
function openSyncModal() {
  openModal('syncModal');
}

function handleSyncFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const newData = JSON.parse(e.target.result);
      if (!Array.isArray(newData) || newData.length === 0) {
        document.getElementById('syncStatus').innerHTML = '<div class="status error">❌ File JSON không hợp lệ hoặc rỗng</div>';
        return;
      }
      
      const statusEl = document.getElementById('syncStatus');
      statusEl.innerHTML = `<div class="status info">📊 Đang phân tích ${newData.length} phòng từ file...</div>`;
      
      // Find new rooms (by slug or URL not in existing data)
      const existingSlugs = new Set(adminRooms.map(r => {
        if (r.moithueUrl) {
          const m = r.moithueUrl.match(/\/listing\/([^/]+)\//);
          return m ? m[1] : r.id;
        }
        return r.id;
      }));
      
      const newRooms = [];
      const updatedRooms = [];
      
      newData.forEach(item => {
        const slug = item.slug || (item.url ? item.url.match(/\/listing\/([^/]+)\//)?.[1] : null);
        if (slug && !existingSlugs.has(slug)) {
          // New room - convert to our format
          const room = convertMoithueToRoom(item);
          if (room) newRooms.push(room);
        }
      });
      
      if (newRooms.length === 0) {
        statusEl.innerHTML = `<div class="status info">ℹ️ Không tìm thấy phòng mới. Tất cả ${newData.length} phòng đã có trong hệ thống.</div>`;
        return;
      }
      
      statusEl.innerHTML = `
        <div class="status success">✅ Tìm thấy ${newRooms.length} phòng mới!</div>
        <div style="margin-top: 10px; max-height: 200px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 8px; padding: 10px;">
          ${newRooms.map(r => `<div style="padding: 4px 0; border-bottom: 1px solid #f1f5f9; font-size: 0.85rem;"><strong>${r.title}</strong> - ${r.address} - ${r.price}</div>`).join('')}
        </div>
        <button class="btn" style="margin-top: 12px; background: #0284c7;" onclick="confirmSync(${newRooms.length})">
          <i class="fas fa-plus-circle"></i> Thêm ${newRooms.length} phòng mới vào hệ thống
        </button>
      `;
      
      // Store for confirmation
      window._pendingSyncRooms = newRooms;
      
    } catch(err) {
      document.getElementById('syncStatus').innerHTML = `<div class="status error">❌ Lỗi đọc file: ${err.message}</div>`;
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

function convertMoithueToRoom(item) {
  // Convert moithue.com listing format to our room format
  try {
    const priceStr = (item.price || item.basicPrice || '').replace(/[^0-9]/g, '');
    const price = parseInt(priceStr) || 0;
    const areaStr = (item.area || '').replace(/[^0-9]/g, '');
    const area = parseInt(areaStr) || 20;
    
    const slug = item.slug || (item.url ? item.url.match(/\/listing\/([^/]+)\//)?.[1] : 'unknown-' + Date.now());
    const title = transformMoithueName(item.title || item.basicTitle || slug);
    const address = transformMoithueName(item.address || item.basicAddress || '');
    const url = item.url || `https://moithue.com/listing/${slug}/`;
    
    // Determine source group from address/categories
    const sourceGroup = guessSourceGroup(address, item.categories || []);
    const district = guessDistrict(address);
    
    return {
      id: 'MT-' + slug.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 30),
      title,
      price,
      address,
      district,
      sourceGroup,
      categoryName: 'Khép kín',
      roomLayout: 'STUDIO',
      tag: 'Khép kín',
      status: 'available',
      statusName: 'Còn phòng',
      area,
      floor: item.floor || 'Tầng 3 / 6 tầng',
      maxPeople: 2,
      elevator: true,
      furnishLevel: 'Full đồ',
      maxVehicles: 2,
      petAllowed: false,
      electricVehicle: false,
      foreignGuest: false,
      nearParking: true,
      nearMainRoad: true,
      loft: false,
      images: (item.images || []).slice(0, 6),
      amenities: ['Điều hòa', 'Nóng lạnh', 'Giường', 'Tủ quần áo'],
      description: `${title} tại ${address}.`,
      detailDescription: { info: '', service: '', note: '', amenity: '' },
      moithueUrl: url,
      createdAt: new Date().toISOString(),
      sourceGroupName: guessSourceGroupName(sourceGroup),
      electricVehiclePolicy: 'unspecified',
      electricVehicleNote: 'Liên hệ chủ nhà'
    };
  } catch(e) {
    console.error('Convert error:', e);
    return null;
  }
}

function guessSourceGroup(address, categories) {
  const addr = (address || '').toLowerCase();
  const cats = (categories || []).join(' ').toLowerCase();
  const combined = addr + ' ' + cats;
  
  if (combined.includes('hoài đức') || combined.includes('an khánh') || combined.includes('phú vinh') || combined.includes('hinode') || combined.includes('di trạch') || combined.includes('vân canh')) return 'nguon-hoai-duc';
  if (combined.includes('cầu giấy') || combined.includes('dịch vọng')) return 'nguon-cau-giay';
  if (combined.includes('hoàng mai') || combined.includes('định công') || combined.includes('lĩnh nam') || combined.includes('vĩnh hưng')) return 'nguon-hoang-mai';
  if (combined.includes('mỹ đình') || combined.includes('my dinh')) return 'nguon-my-dinh';
  if (combined.includes('nam từ liêm') || combined.includes('mễ trì')) return 'nguon-nam-tu-liem';
  if (combined.includes('bắc từ liêm') || combined.includes('xuân đỉnh') || combined.includes('cổ nhuế')) return 'nguon-xuan-dinh';
  if (combined.includes('thanhh xuan') || combined.includes('thanh xuân')) return 'nguon-thanh-xuan';
  if (combined.includes('ba đình') || combined.includes('tây hồ')) return 'nguon-ba-dinh';
  if (combined.includes('đống đa') || combined.includes('dong da')) return 'nguon-dong-da';
  if (combined.includes('cầu diễn')) return 'nguon-cau-dien';
  if (combined.includes('kim giang') || combined.includes('ngọc hồi')) return 'nguon-kim-giang-ngoc-hoi';
  if (combined.includes('triều khúc')) return 'nguon-trieu-khuc';
  if (combined.includes('phú diễn')) return 'nguon-phu-dien';
  if (combined.includes('xuân phương')) return 'nguon-xuan-phuong';
  if (combined.includes('yên xá') || combined.includes('mậu lương')) return 'nguon-yen-xa-mau-luong';
  return 'nguon-cau-giay';
}

function guessDistrict(address) {
  const addr = (address || '').toLowerCase();
  if (addr.includes('hoài đức') || addr.includes('an khánh') || addr.includes('phú vinh') || addr.includes('hinode') || addr.includes('di trạch')) return 'hoai-duc';
  if (addr.includes('cầu giấy') || addr.includes('dịch vọng')) return 'cau-giay';
  if (addr.includes('hoàng mai') || addr.includes('định công') || addr.includes('lĩnh nam') || addr.includes('vĩnh hưng')) return 'hoang-mai';
  if (addr.includes('mỹ đình')) return 'nam-tu-liem';
  if (addr.includes('nam từ liêm') || addr.includes('mễ trì')) return 'nam-tu-liem';
  if (addr.includes('bắc từ liêm') || addr.includes('xuân đỉnh') || addr.includes('cổ nhuế')) return 'bac-tu-liem';
  if (addr.includes('thanh xuân')) return 'thanh-xuan';
  if (addr.includes('ba đình')) return 'ba-dinh';
  if (addr.includes('tây hồ')) return 'tay-ho';
  if (addr.includes('đống đa')) return 'dong-da';
  if (addr.includes('cầu diễn')) return 'bac-tu-liem';
  if (addr.includes('hà đông')) return 'ha-dong';
  return 'cau-giay';
}

function guessSourceGroupName(sourceGroup) {
  const map = {
    'nguon-hoai-duc': 'Hoài Đức',
    'nguon-cau-giay': 'Cầu Giấy',
    'nguon-hoang-mai': 'Hoàng Mai',
    'nguon-my-dinh': 'Mỹ Đình',
    'nguon-nam-tu-liem': 'Nam Từ Liêm',
    'nguon-xuan-dinh': 'Cổ Nhuế, Xuân Đỉnh',
    'nguon-thanh-xuan': 'Thanh Xuân',
    'nguon-ba-dinh': 'Ba Đình - Tây Hồ',
    'nguon-dong-da': 'Đống Đa',
    'nguon-cau-dien': 'Cầu Diễn',
    'nguon-kim-giang-ngoc-hoi': 'Kim Giang, Ngọc Hồi',
    'nguon-trieu-khuc': 'Triều Khúc',
    'nguon-phu-dien': 'Phú Diễn',
    'nguon-xuan-phuong': 'Xuân Phương',
    'nguon-yen-xa-mau-luong': 'Yên Xá/Mậu Lương'
  };
  return map[sourceGroup] || sourceGroup;
}

function confirmSync(count) {
  const newRooms = window._pendingSyncRooms;
  if (!newRooms || newRooms.length === 0) return;
  
  if (confirm(`Thêm ${newRooms.length} phòng mới vào hệ thống?`)) {
    adminRooms = [...adminRooms, ...newRooms];
    localStorage.setItem(STORAGE_ROOMS_KEY, JSON.stringify(adminRooms));
    renderAdminStats();
    renderRoomsTable();
    closeModal('syncModal');
    showToast(`🎉 Đã thêm thành công ${newRooms.length} phòng mới từ moithue.com!`);
    
    // Update tab title
    const tabBtn = document.querySelector('.tab-btn.active');
    if (tabBtn) tabBtn.innerHTML = `<i class="fas fa-home"></i> Quản Lý Danh Sách ${adminRooms.length} Phòng Trọ`;
  }
}

// ==========================================================================
// FETCH AND ADD ROOMS (HỖ TRỢ NHIỀU LINK CÙNG NGUỒN & KHU VỰC CÙNG LÚC)
// ==========================================================================
function extractMoithueLinks(text) {
  if (!text) return [];
  const matches = text.match(/https?:\/\/(?:www\.)?moithue\.com\/listing\/[a-zA-Z0-9_\-]+(?:\/)?/gi) || [];
  const seen = new Set();
  const links = [];
  for (const raw of matches) {
    const url = raw.endsWith('/') ? raw : raw + '/';
    if (!seen.has(url)) {
      seen.add(url);
      links.push(url);
    }
  }
  return links;
}

function updateLinksCountBadge() {
  const input = document.getElementById('moithueLinksInput') || document.getElementById('moithueLinkInput');
  const badge = document.getElementById('linksCountBadge');
  if (!input || !badge) return;
  const links = extractMoithueLinks(input.value);
  badge.innerText = `${links.length} link được nhập`;
  badge.style.background = links.length > 0 ? '#bbf7d0' : '#dcfce7';
  badge.style.color = links.length > 0 ? '#14532d' : '#15803d';
}

async function fetchAndAddRooms() {
  const inputEl = document.getElementById('moithueLinksInput') || document.getElementById('moithueLinkInput');
  const sourceGroupSelect = document.getElementById('syncSourceGroup');
  const districtSelect = document.getElementById('syncDistrict');
  const statusEl = document.getElementById('fetchedStatus');
  const btn = document.getElementById('fetchUpBtn');

  const text = inputEl ? inputEl.value.trim() : '';
  const links = extractMoithueLinks(text);

  if (links.length === 0) {
    alert('Vui lòng dán ít nhất 1 link phòng từ moithue.com!\nVí dụ: https://moithue.com/listing/slug-phong/');
    if (inputEl) inputEl.focus();
    return;
  }

  const sourceGroup = sourceGroupSelect ? sourceGroupSelect.value : 'nguon-cau-giay';
  const district = districtSelect ? districtSelect.value : 'cau-giay';

  // Khóa nút bấm và dựng giao diện tiến độ
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Đang tải 0/${links.length} phòng...`;
  }

  if (statusEl) {
    statusEl.innerHTML = `
      <div style="margin-top: 16px; background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 12px; padding: 16px;">
        <div style="display: flex; justify-content: space-between; font-weight: 700; font-size: 0.92rem; color: #1e293b; margin-bottom: 8px;">
          <span><i class="fas fa-tasks" style="color: #0284c7;"></i> Tiến độ tải phòng:</span>
          <span id="batchPercentText" style="color: #0284c7;">0 / ${links.length} (0%)</span>
        </div>
        <div style="width: 100%; height: 10px; background: #e2e8f0; border-radius: 6px; overflow: hidden; margin-bottom: 12px;">
          <div id="batchProgressBar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #059669, #10b981); transition: width 0.3s ease;"></div>
        </div>
        <div id="batchLogsList" style="max-height: 220px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; font-size: 0.85rem; padding-right: 4px;"></div>
      </div>
    `;
  }

  const batchProgressBar = document.getElementById('batchProgressBar');
  const batchPercentText = document.getElementById('batchPercentText');
  const batchLogsList = document.getElementById('batchLogsList');

  const successRooms = [];
  const failedRooms = [];

  for (let i = 0; i < links.length; i++) {
    const link = links[i];
    const currentIndex = i + 1;
    const percent = Math.round((i / links.length) * 100);

    if (btn) {
      btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Đang tải [${currentIndex}/${links.length}]...`;
    }
    if (batchProgressBar) batchProgressBar.style.width = `${percent}%`;
    if (batchPercentText) batchPercentText.innerText = `${i} / ${links.length} (${percent}%)`;

    // Thêm dòng log đang tải
    const logItem = document.createElement('div');
    logItem.id = `batchLogItem-${i}`;
    logItem.style.cssText = 'padding: 8px 12px; background: white; border-radius: 6px; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; gap: 10px;';
    logItem.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">
        <i class="fas fa-spinner fa-spin" style="color: #0284c7;"></i>
        <span style="color: #475569; font-weight: 700;">[${currentIndex}/${links.length}]</span>
        <span style="color: #1e293b; overflow: hidden; text-overflow: ellipsis;">${link}</span>
      </div>
      <span style="font-size: 0.78rem; color: #64748b; font-weight: 700;">Đang lấy dữ liệu...</span>
    `;
    if (batchLogsList) {
      batchLogsList.appendChild(logItem);
      logItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    try {
      const response = await fetch('/api/fetch-listing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: link, sourceGroup, district })
      });

      const result = await response.json();
      if (!response.ok || result.error) {
        throw new Error(result.error || 'Lỗi server');
      }

      const room = result.room;
      if (room.title) room.title = transformMoithueName(room.title);
      if (room.address) room.address = transformMoithueName(room.address);

      // Đảm bảo thông tin phòng độc lập hoàn toàn (không nhầm lẫn)
      const existingIdx = adminRooms.findIndex(r => {
        if (r.moithueSlug && r.moithueSlug === room.moithueSlug) return true;
        if (r.moithueUrl && r.moithueUrl === room.moithueUrl) return true;
        if (r.id === room.id) return true;
        return false;
      });

      const isNew = existingIdx === -1;
      if (isNew) {
        adminRooms.unshift(room);
      } else {
        const existing = adminRooms[existingIdx];
        room.status = existing.status;
        room.statusName = existing.statusName;
        adminRooms[existingIdx] = room;
      }

      successRooms.push({ room, isNew });

      // Cập nhật dòng log thành công
      if (logItem) {
        logItem.style.borderColor = '#86efac';
        logItem.style.background = '#f0fdf4';
        logItem.innerHTML = `
          <div style="display: flex; align-items: center; gap: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">
            <i class="fas fa-check-circle" style="color: #16a34a;"></i>
            <span style="color: #166534; font-weight: 700;">[${currentIndex}/${links.length}]</span>
            <span style="color: #0f172a; font-weight: 800; overflow: hidden; text-overflow: ellipsis;">${room.title}</span>
          </div>
          <span style="font-size: 0.78rem; background: ${isNew ? '#bbf7d0' : '#fef08a'}; color: ${isNew ? '#166534' : '#854d0e'}; padding: 3px 10px; border-radius: 12px; font-weight: 700; white-space: nowrap;">
            ${isNew ? '🆕 Thêm mới' : '🔄 Cập nhật'}
          </span>
        `;
      }
    } catch (err) {
      failedRooms.push({ link, error: err.message });
      if (logItem) {
        logItem.style.borderColor = '#fca5a5';
        logItem.style.background = '#fef2f2';
        logItem.innerHTML = `
          <div style="display: flex; align-items: center; gap: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">
            <i class="fas fa-times-circle" style="color: #dc2626;"></i>
            <span style="color: #dc2626; font-weight: 700;">[${currentIndex}/${links.length}]</span>
            <span style="color: #991b1b; overflow: hidden; text-overflow: ellipsis;">${link}</span>
          </div>
          <span style="font-size: 0.78rem; background: #fee2e2; color: #dc2626; padding: 3px 8px; border-radius: 12px; font-weight: 700; white-space: nowrap;">
            ❌ ${err.message}
          </span>
        `;
      }
    }

    // Nghỉ nhẹ 300ms giữa các phòng để đảm bảo ổn định
    if (i < links.length - 1) {
      await new Promise(r => setTimeout(r, 300));
    }
  }

  // Kết thúc tiến trình 100%
  if (batchProgressBar) batchProgressBar.style.width = '100%';
  if (batchPercentText) batchPercentText.innerText = `${links.length} / ${links.length} (100%)`;

  // Lưu ngay vào localStorage và file rooms_new.json trên máy chủ
  if (successRooms.length > 0) {
    localStorage.setItem(STORAGE_ROOMS_KEY, JSON.stringify(adminRooms));
    fetch('/api/save-rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(adminRooms)
    }).catch(e => console.warn('Could not persist to server rooms_new.json', e));

    renderAdminStats();
    renderRoomsTable();
  }

  // Khôi phục nút bấm
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = `<i class="fas fa-cloud-upload-alt"></i> UP TẤT CẢ PHÒNG LÊN WEBSITE`;
  }

  showToast(`🎉 Đã xử lý xong: ${successRooms.length} thành công${failedRooms.length > 0 ? `, ${failedRooms.length} thất bại` : ''}!`);

  if (inputEl) {
    if (failedRooms.length > 0) {
      inputEl.value = failedRooms.map(f => f.link).join('\n');
    } else {
      inputEl.value = '';
    }
    updateLinksCountBadge();
  }

  // Hiển thị tổng kết danh sách phòng đã up
  if (statusEl) {
    const summaryCard = document.createElement('div');
    summaryCard.style.cssText = `margin-top: 14px; background: ${failedRooms.length === 0 ? '#f0fdf4' : '#fffbeb'}; border: 1.5px solid ${failedRooms.length === 0 ? '#86efac' : '#fde68a'}; border-radius: 10px; padding: 14px;`;
    summaryCard.innerHTML = `
      <div style="font-weight: 800; color: ${failedRooms.length === 0 ? '#166534' : '#92400e'}; font-size: 0.98rem; display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
        <span>
          <i class="fas ${failedRooms.length === 0 ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i> 
          Kết quả: ${successRooms.length} phòng thành công${failedRooms.length > 0 ? `, ${failedRooms.length} link lỗi` : ''}
        </span>
        <span style="font-size: 0.82rem; background: white; padding: 3px 10px; border-radius: 12px; border: 1px solid ${failedRooms.length === 0 ? '#86efac' : '#fde68a'};">
          Tổng kho: ${adminRooms.length} phòng
        </span>
      </div>

      ${successRooms.length > 0 ? `
        <div style="max-height: 240px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; margin-top: 8px;">
          ${successRooms.map(({ room, isNew }) => `
            <div style="display: flex; align-items: center; gap: 10px; background: white; padding: 8px 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
              <img src="${room.images && room.images[0] ? room.images[0] : ''}" 
                style="width: 54px; height: 42px; object-fit: cover; border-radius: 6px; flex-shrink: 0;"
                onerror="this.src='https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80'">
              <div style="flex: 1; min-width: 0;">
                <div style="font-weight: 800; font-size: 0.88rem; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  ${room.title}
                </div>
                <div style="font-size: 0.78rem; color: #64748b; margin-top: 2px;">
                  ${new Intl.NumberFormat('vi-VN').format(room.price)} đ/tháng · ${room.area}m² · ${room.sourceGroupName || ''}
                </div>
              </div>
              <span style="font-size: 0.75rem; font-weight: 700; padding: 3px 8px; border-radius: 10px; ${isNew ? 'background: #dcfce7; color: #166534;' : 'background: #fef9c3; color: #854d0e;'}">
                ${isNew ? '🆕 Thêm mới' : '🔄 Cập nhật'}
              </span>
            </div>
          `).join('')}
        </div>
      ` : ''}
    `;
    statusEl.appendChild(summaryCard);
  }
}

// Alias tương thích ngược
const fetchAndAddRoom = fetchAndAddRooms;

// ==========================================================================
// IMPORT FETCHED LISTING (from fetch_listing.js)
// Replaces existing room with same moithueSlug, or adds as new
// ==========================================================================
function handleFetchedFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const room = JSON.parse(e.target.result);
      
      // Validate it's a room object
      if (!room || !room.title || !room.address) {
        document.getElementById('fetchedStatus').innerHTML = 
          '<div style="color: #dc2626; font-weight: 700; margin-top: 10px;">❌ File không hợp lệ. Cần file từ fetch_listing.js</div>';
        return;
      }
      
      const statusEl = document.getElementById('fetchedStatus');
      statusEl.innerHTML = `<div style="color: #0284c7; font-weight: 600; margin-top: 10px;">📊 Đang phân tích: ${room.title}...</div>`;
      
      // Check if room already exists (by moithueSlug or moithueUrl)
      const slug = room.moithueSlug || '';
      const existingIdx = adminRooms.findIndex(r => {
        if (r.moithueSlug && r.moithueSlug === slug) return true;
        if (r.moithueUrl && room.moithueUrl && r.moithueUrl === room.moithueUrl) return true;
        if (r.id && r.id === room.id) return true;
        return false;
      });
      
      const isNew = existingIdx === -1;
      const action = isNew ? 'thêm mới' : 'thay thế';
      
      statusEl.innerHTML = `
        <div style="margin-top: 12px; background: ${isNew ? '#f0fdf4' : '#fef3c7'}; border: 1px solid ${isNew ? '#86efac' : '#fcd34d'}; border-radius: 8px; padding: 14px;">
          <div style="font-weight: 700; color: ${isNew ? '#166534' : '#92400e'}; margin-bottom: 8px;">
            ${isNew ? '🆕 Phòng mới' : '🔄 Phòng đã tồn tại'} - Sẽ ${action}:
          </div>
          <div style="display: flex; gap: 12px; align-items: start;">
            <img src="${room.images && room.images[0] ? room.images[0] : 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80'}" 
              style="width: 80px; height: 65px; object-fit: cover; border-radius: 6px; border: 1px solid #e2e8f0;">
            <div>
              <div style="font-weight: 700; color: #0f172a;">${room.title}</div>
              <div style="font-size: 0.82rem; color: #64748b;">${room.address}</div>
              <div style="font-size: 0.85rem; color: #0284c7; font-weight: 600; margin-top: 4px;">
                ${new Intl.NumberFormat('vi-VN').format(room.price)}đ/tháng · ${room.area}m² · ${room.roomLayout}
              </div>
              <div style="font-size: 0.78rem; color: #64748b; margin-top: 2px;">Nguồn: ${room.sourceGroupName || room.sourceGroup}</div>
            </div>
          </div>
        </div>
        <button onclick="confirmFetchedImport(${isNew}, ${existingIdx})" 
          style="margin-top: 12px; background: linear-gradient(135deg, ${isNew ? '#059669, #047857' : '#d97706, #b45309'}); color: white; border: none; padding: 11px 22px; border-radius: 8px; font-weight: 700; font-size: 0.95rem; cursor: pointer; display: inline-flex; align-items: center; gap: 8px;">
          <i class="fas ${isNew ? 'fa-plus-circle' : 'fa-sync-alt'}"></i> 
          ${isNew ? 'Thêm phòng này vào hệ thống' : 'Thay thế dữ liệu phòng cũ'}
        </button>
      `;
      
      // Store for confirmation
      window._pendingFetchedRoom = room;
      window._pendingFetchedIsNew = isNew;
      window._pendingFetchedIdx = existingIdx;
      
    } catch(err) {
      document.getElementById('fetchedStatus').innerHTML = 
        `<div style="color: #dc2626; font-weight: 700; margin-top: 10px;">❌ Lỗi đọc file: ${err.message}</div>`;
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

function confirmFetchedImport(isNew, existingIdx) {
  const room = window._pendingFetchedRoom;
  if (!room) return;
  
  if (isNew) {
    // Add new room
    adminRooms.unshift(room);
    showToast(`🎉 Đã thêm phòng mới: ${room.title}`);
  } else {
    // Replace existing room - keep admin-managed fields (status)
    const existing = adminRooms[existingIdx];
    room.status = existing.status;
    room.statusName = existing.statusName;
    adminRooms[existingIdx] = room;
    showToast(`🔄 Đã cập nhật phòng: ${room.title}`);
  }
  
  localStorage.setItem(STORAGE_ROOMS_KEY, JSON.stringify(adminRooms));
  fetch('/api/save-rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(adminRooms)
  }).catch(e => console.warn('Could not persist to server rooms_new.json', e));

  closeModal('syncModal');
  renderAdminStats();
  renderRoomsTable();
}
