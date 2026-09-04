// ==========================================================================
// APP STATE & INITIALIZATION - CHUYÊN VIÊN TƯ VẤN: ĐẶNG VĂN TUYỂN (0358954360)
// ==========================================================================
let rooms = [];
let wishlist = [];
let currentFilter = {
  keyword: "",
  district: "all",
  sourceGroup: "all",
  roomType: "all",
  priceRange: "all",
  minPrice: null,
  maxPrice: null,
  sortBy: "newest",
  onlyFavorites: false,
  roomLayout: "all",
  capacity: "all",
  vehicles: "all",
  elevator: "all",
  pet: "all",
  electricVehicle: "all",
  evAllowed: false,
  evVin: false,
  evForbidden: false,
  foreignGuest: "all",
  nearParking: false,
  nearMainRoad: false,
  loft: "all",
  amenities: []
};

// Storage keys
const STORAGE_ROOMS_KEY = "thuetro_rooms_v20";
const STORAGE_WISHLIST_KEY = "thuetro_wishlist_ids";
const STORAGE_BOOKINGS_KEY = "thuetro_bookings_list";

const CONSULTANT_NAME = "Đặng Văn Tuyển";
const CONSULTANT_PHONE = "0358954360";
const CONSULTANT_ZALO = "0358954360";

// Fallback image URL
const DEFAULT_ROOM_IMAGE = "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80";

let heroDistrictSelectComponent = null;
let heroSourceGroupSelectComponent = null;
let sidebarDistrictSelectComponent = null;
let sidebarSourceGroupSelectComponent = null;

document.addEventListener("DOMContentLoaded", () => {
  initData();
  initSearchableSelects();
  initEventListeners();
  renderRooms();
  updateWishlistCount();
});

function transformMoithueName(str) {
  if (!str) return '';
  return str.replace(/(?:^|\b)(?:(?:ngõ|ngách)\s+)?(\d+)\.\d+\s+(?!(?:triệu|tỷ|m2|m²|tr\s*\/|tr\s*$))/gi, (match, alley) => 'ngõ ' + alley + ' ').trim();
}

// Load or initialize room data
function initData() {
  const savedRooms = localStorage.getItem(STORAGE_ROOMS_KEY);
  if (savedRooms !== null) {
    try {
      rooms = JSON.parse(savedRooms).map(r => {
        if (r.title) r.title = transformMoithueName(r.title);
        if (r.address) r.address = transformMoithueName(r.address);
        return r;
      });
    } catch (e) {
      rooms = [];
    }
    renderRooms();
    updateSidebarCounts();
  } else {
    // If not in localStorage, fetch from server API / rooms_new.json
    fetch('/api/rooms')
      .then(res => res.json())
      .then(data => {
        rooms = Array.isArray(data) ? data.map(r => {
          if (r.title) r.title = transformMoithueName(r.title);
          if (r.address) r.address = transformMoithueName(r.address);
          return r;
        }) : [];
        try {
          localStorage.setItem(STORAGE_ROOMS_KEY, JSON.stringify(rooms));
        } catch (e) {}
        renderRooms();
        updateSidebarCounts();
      })
      .catch(() => {
        rooms = [];
        renderRooms();
        updateSidebarCounts();
      });
  }

  const savedWishlist = localStorage.getItem(STORAGE_WISHLIST_KEY);
  if (savedWishlist) {
    try {
      wishlist = JSON.parse(savedWishlist);
    } catch (e) {
      wishlist = [];
    }
  }
}

// ==========================================================================
// RENDER ROOM CARDS (PAGINATION: 24 ROOMS PER PAGE CHUẨN LISTIVO / MỜI THUÊ)
// ==========================================================================
let currentPage = 1;
const roomsPerPage = 24;

function renderRooms() {
  const grid = document.getElementById("roomGrid");
  const countDisplay = document.getElementById("resultsCount");
  const pagiContainer = document.getElementById("roomPaginationContainer");
  
  updateSidebarCounts();

  if (!grid) return;

  const filtered = getFilteredRooms();
  const totalRooms = filtered.length;
  const totalPages = Math.ceil(totalRooms / roomsPerPage) || 1;

  // Luôn đảm bảo currentPage nằm trong khoảng hợp lệ
  if (currentPage > totalPages) {
    currentPage = totalPages;
  }
  if (currentPage < 1) {
    currentPage = 1;
  }
  
  if (countDisplay) {
    if (rooms.length === 0) {
      countDisplay.innerText = "Chưa có phòng nào trên hệ thống (0 phòng)";
    } else if (totalRooms === rooms.length) {
      countDisplay.innerText = `Hiển thị tất cả ${totalRooms} phòng trọ`;
    } else {
      countDisplay.innerText = `Tìm thấy ${totalRooms} / ${rooms.length} phòng trọ phù hợp`;
    }
  }

  if (totalRooms === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; background: white; border-radius: var(--radius-md); border: 1px dashed var(--border-color);">
        <i class="fas fa-home" style="font-size: 3rem; color: var(--text-light); margin-bottom: 16px;"></i>
        <h3 style="font-size: 1.3rem; color: var(--dark); margin-bottom: 8px;">
          ${rooms.length === 0 ? 'Hiện tại chưa có phòng nào trên hệ thống' : 'Không tìm thấy phòng phù hợp'}
        </h3>
        <p style="color: var(--text-muted); margin-bottom: 20px;">
          ${rooms.length === 0 ? 'Vui lòng truy cập trang Quản trị Admin để dán link và thêm phòng mới.' : 'Vui lòng thử điều chỉnh lại bộ lọc hoặc tìm kiếm theo từ khóa khác.'}
        </p>
        ${rooms.length === 0 ? `
          <a href="admin.html" class="btn-schedule-view" style="text-decoration: none; display: inline-flex; align-items: center; gap: 8px; background: var(--primary);">
            <i class="fas fa-plus-circle"></i> Đến trang Quản trị Admin để thêm phòng
          </a>
        ` : `
          <button class="btn-schedule-view" onclick="resetAllFilters()">
            <i class="fas fa-redo"></i> Xóa tất cả bộ lọc
          </button>
        `}
      </div>
    `;
    if (pagiContainer) pagiContainer.innerHTML = "";
    return;
  }

  const startIndex = (currentPage - 1) * roomsPerPage;
  const displayedRooms = filtered.slice(startIndex, startIndex + roomsPerPage);

  const cardsHtml = displayedRooms.map(room => {
    const isSaved = wishlist.includes(room.id);
    const priceFormatted = new Intl.NumberFormat('vi-VN').format(room.price) + " đ";
    
    // Build slider images (Chỉ nạp trước ảnh đầu tiên, các ảnh sau nạp theo yêu cầu để web siêu nhanh trên điện thoại)
    const slidesHtml = room.images.map((img, idx) => `
      <img ${idx === 0 ? `src="${img}"` : `data-src="${img}"`} class="card-slide-img" style="display: ${idx === 0 ? 'block' : 'none'};" data-index="${idx}" alt="${room.title}" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null; this.src='${DEFAULT_ROOM_IMAGE}'">
    `).join("");

    const dotsHtml = room.images.map((_, idx) => `
      <div class="slider-dot ${idx === 0 ? 'active' : ''}" data-index="${idx}"></div>
    `).join("");

    // Xe điện badge
    let evBadgeHtml = "";
    if (room.electricVehiclePolicy === 'vinfast_only') {
      evBadgeHtml = `<span class="badge-ev-vin" title="${room.electricVehicleNote || 'Chỉ nhận xe điện VinFast / Đổi pin'}"><i class="fas fa-motorcycle"></i> Xe Vin</span>`;
    } else if (room.electricVehiclePolicy === 'allowed') {
      evBadgeHtml = `<span class="badge-ev-ok" title="${room.electricVehicleNote || 'Nhận xe điện'}"><i class="fas fa-bolt"></i> Xe điện</span>`;
    } else if (room.electricVehiclePolicy === 'forbidden') {
      evBadgeHtml = `<span class="badge-ev-no" title="${room.electricVehicleNote || 'Cấm xe điện'}"><i class="fas fa-ban"></i> Cấm xe điện</span>`;
    }

    return `
      <div class="room-card" data-room-id="${room.id}" onclick="openRoomDetailModal('${room.id}', true)" style="cursor: pointer;">
        <div class="card-media-wrapper">
          <div class="card-badges">
            <span class="badge-code" style="background: rgba(13, 148, 136, 0.9);">${room.tag || room.categoryName}</span>
            <span class="badge-status ${room.status === 'rented' ? 'rented' : ''}">
              <i class="fas fa-circle" style="font-size: 6px;"></i> ${room.statusName || 'Còn phòng'}
            </span>
            ${evBadgeHtml}
          </div>

          <div class="card-actions-top">
            <button class="btn-wishlist ${isSaved ? 'active' : ''}" title="Lưu phòng yêu thích" onclick="toggleWishlist('${room.id}', event)">
              <i class="${isSaved ? 'fas fa-heart' : 'far fa-heart'}"></i>
            </button>
          </div>

          <!-- Nút Xem nhanh nổi trên ảnh -->
          <button class="btn-media-quickview" onclick="openRoomDetailModal('${room.id}', false, event)" title="Xem nhanh thông tin phòng">
            <i class="fas fa-eye"></i> Xem nhanh
          </button>

          <div class="card-image-slider" id="slider-${room.id}">
            ${slidesHtml}
            <button class="slider-btn prev" onclick="changeCardSlide('${room.id}', -1, event)">
              <i class="fas fa-chevron-left"></i>
            </button>
            <button class="slider-btn next" onclick="changeCardSlide('${room.id}', 1, event)">
              <i class="fas fa-chevron-right"></i>
            </button>
            <div class="slider-dots">${dotsHtml}</div>
          </div>
        </div>

        <div class="card-content">
          <div class="card-category">${room.categoryName || 'Phòng Trọ'}</div>
          <h3 class="card-title">${room.title}</h3>
          
          <div class="card-location">
            <i class="fas fa-map-marker-alt"></i>
            <span>${room.address}</span>
          </div>

          <div class="card-specs">
            <div class="spec-item">
              <i class="fas fa-vector-square"></i>
              <span>${room.area} m²</span>
            </div>
            <div class="spec-item">
              <i class="fas fa-layer-group"></i>
              <span>${room.floor.split('/')[0]}</span>
            </div>
            <div class="spec-item">
              <i class="fas fa-user-friends"></i>
              <span>Tối đa ${room.maxPeople} người</span>
            </div>
          </div>

          <div class="card-footer">
            <div class="price-box">
              <span class="price-value">${priceFormatted}</span>
              <span class="price-unit">/ tháng</span>
            </div>
            <div class="card-cta-group">
              <button class="btn-quick-view" onclick="openRoomDetailModal('${room.id}', false, event)" title="Xem nhanh phòng này">
                <i class="fas fa-eye"></i> Xem nhanh
              </button>
              <button class="btn-schedule-view" onclick="contactZaloRoom('${room.id}', event)" style="background: linear-gradient(135deg, #0068FF, #0052cc); box-shadow: 0 4px 12px rgba(0, 104, 255, 0.25);">
                <i class="fas fa-comment-dots"></i> Nhắn Zalo
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join("");

  grid.innerHTML = cardsHtml;
  renderPagination(totalRooms, currentPage, roomsPerPage);
}

// ==========================================================================
// RENDER NUMBERED PAGINATION (CHUẨN GIAO DIỆN LISTIVO / MỜI THUÊ)
// ==========================================================================
function renderPagination(totalRooms, page, perPage) {
  const container = document.getElementById("roomPaginationContainer");
  if (!container) return;

  if (totalRooms === 0) {
    container.innerHTML = "";
    return;
  }

  const totalPages = Math.ceil(totalRooms / perPage);
  const startItem = (page - 1) * perPage + 1;
  const endItem = Math.min(page * perPage, totalRooms);

  const prevSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="11" viewBox="0 0 12 11" fill="none"><path d="M4.86195 10.4713C4.99228 10.6017 5.16262 10.6667 5.33329 10.6667C5.50395 10.6667 5.67429 10.6017 5.80462 10.4713C6.06496 10.211 6.06496 9.78898 5.80462 9.52865L2.27593 5.99996H11.3333C11.7013 5.99996 12 5.70129 12 5.33329C12 4.96528 11.7013 4.66662 11.3333 4.66662H2.27593L5.80462 1.13792C6.06496 0.877589 6.06496 0.455586 5.80462 0.195251C5.54429 -0.0650838 5.12229 -0.0650838 4.86195 0.195251L0.195251 4.86195C-0.0650838 5.12229 -0.0650838 5.54429 0.195251 5.80462L4.86195 10.4713Z" fill="currentColor"></path></svg>`;
  const nextSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="11" viewBox="0 0 12 11" fill="none"><path d="M7.13805 10.4713C7.00772 10.6017 6.83738 10.6667 6.66671 10.6667C6.49605 10.6667 6.32571 10.6017 6.19538 10.4713C5.93504 10.211 5.93504 9.78898 6.19538 9.52865L9.72407 5.99996H0.666672C0.298669 5.99996 0 5.70129 0 5.33329C0 4.96528 0.298669 4.66662 0.666672 4.66662H9.72407L6.19538 1.13792C5.93504 0.877589 5.93504 0.455586 6.19538 0.195251C6.45571 -0.0650838 6.87771 -0.0650838 7.13805 0.195251L11.8047 4.86195C12.0651 5.12229 12.0651 5.54429 11.8047 5.80462L7.13805 10.4713Z" fill="currentColor"></path></svg>`;

  let pageItemsHtml = "";

  // Nút Prev
  const isPrevDisabled = page <= 1;
  pageItemsHtml += `
    <div class="listivo-pagination__item ${isPrevDisabled ? 'listivo-pagination__item--disabled' : ''}" 
         onclick="${isPrevDisabled ? '' : `goToPage(${page - 1})`}" 
         title="Trang trước">
      ${prevSvg}
    </div>
  `;

  // Các nút số trang (1, 2, 3...)
  if (totalPages <= 7) {
    for (let p = 1; p <= totalPages; p++) {
      pageItemsHtml += `
        <div class="listivo-pagination__item ${p === page ? 'listivo-pagination__item--active' : ''}" 
             onclick="${p === page ? '' : `goToPage(${p})`}">
          ${p}
        </div>
      `;
    }
  } else {
    const pagesToShow = new Set([1, totalPages, page, page - 1, page + 1].filter(p => p >= 1 && p <= totalPages));
    const sortedPages = Array.from(pagesToShow).sort((a, b) => a - b);

    let lastP = 0;
    for (const p of sortedPages) {
      if (lastP && p - lastP > 1) {
        pageItemsHtml += `<div class="listivo-pagination__item listivo-pagination__item--dots">...</div>`;
      }
      pageItemsHtml += `
        <div class="listivo-pagination__item ${p === page ? 'listivo-pagination__item--active' : ''}" 
             onclick="${p === page ? '' : `goToPage(${p})`}">
          ${p}
        </div>
      `;
      lastP = p;
    }
  }

  // Nút Next
  const isNextDisabled = page >= totalPages;
  pageItemsHtml += `
    <div class="listivo-pagination__item ${isNextDisabled ? 'listivo-pagination__item--disabled' : ''}" 
         onclick="${isNextDisabled ? '' : `goToPage(${page + 1})`}" 
         title="Trang sau">
      ${nextSvg}
    </div>
  `;

  container.innerHTML = `
    <div class="listivo-pagination">
      <div class="listivo-pagination__info">
        Hiển thị <span>${startItem}</span> đến <span>${endItem}</span> trong số <span>${totalRooms}</span> phòng 
        <strong style="color: var(--primary); margin-left: 6px;">(Trang ${page}/${totalPages})</strong>
      </div>
      <div class="listivo-pagination__list">
        ${pageItemsHtml}
      </div>
    </div>
  `;
}

function goToPage(targetPage) {
  currentPage = targetPage;
  renderRooms();
  const listingEl = document.getElementById("listingsSection") || document.getElementById("roomGrid");
  if (listingEl) {
    const yOffset = -70;
    const y = listingEl.getBoundingClientRect().top + window.pageYOffset + yOffset;
    window.scrollTo({ top: y, behavior: "smooth" });
  }
}

// Card image slider navigation
function changeCardSlide(roomId, step, event) {
  if (event) event.stopPropagation();
  const slider = document.getElementById(`slider-${roomId}`);
  if (!slider) return;

  const images = slider.querySelectorAll(".card-slide-img");
  const dots = slider.querySelectorAll(".slider-dot");
  let currentIndex = 0;

  images.forEach((img, idx) => {
    if (img.style.display !== "none") {
      currentIndex = idx;
    }
  });

  let nextIndex = currentIndex + step;
  if (nextIndex < 0) nextIndex = images.length - 1;
  if (nextIndex >= images.length) nextIndex = 0;

  images.forEach((img, idx) => {
    if (idx === nextIndex) {
      if (img.dataset.src && (!img.src || img.src.endsWith('/undefined') || img.src === window.location.href)) {
        img.src = img.dataset.src;
      }
      img.style.display = "block";
    } else {
      img.style.display = "none";
    }
  });

  dots.forEach((dot, idx) => {
    dot.classList.toggle("active", idx === nextIndex);
  });
}

// Filter logic (Toàn bộ tiêu chí lọc chuẩn xác theo giao diện Listivo / Mời Thuê)
function getFilteredRooms() {
  return rooms.filter(room => {
    // 1. Keyword
    if (currentFilter.keyword) {
      const kw = currentFilter.keyword.toLowerCase();
      const matchTitle = room.title.toLowerCase().includes(kw);
      const matchAddress = room.address.toLowerCase().includes(kw);
      const matchTag = (room.tag || "").toLowerCase().includes(kw);
      const matchNear = (room.nearPlaces || []).some(p => p.toLowerCase().includes(kw));
      if (!matchTitle && !matchAddress && !matchTag && !matchNear) return false;
    }

    // 2. District
    if (currentFilter.district !== "all") {
      const d = currentFilter.district.replace(/^(quan-|huyen-)/, '');
      const rd = (room.district || '').replace(/^(quan-|huyen-)/, '');
      if (d !== rd) return false;
    }

    // 3. Source Group
    if (currentFilter.sourceGroup !== "all") {
      const sg = currentFilter.sourceGroup;
      const rsg = room.sourceGroup || '';
      const rDist = (room.district || '').replace(/^(quan-|huyen-)/, '');
      let matchSource = (rsg === sg);
      if (!matchSource) {
        if (sg === 'nguon-ba-dinh' && (rsg.includes('ba-dinh') || rDist === 'ba-dinh' || rDist === 'tay-ho')) matchSource = true;
        else if (sg === 'nguon-cau-dien' && (rsg.includes('cau-dien') || (room.address || '').toLowerCase().includes('cầu diễn'))) matchSource = true;
        else if (sg === 'nguon-cau-giay' && (rsg.includes('cau-giay') || rDist === 'cau-giay')) matchSource = true;
        else if (sg === 'nguon-xuan-dinh' && (rsg.includes('xuan-dinh') || (room.address || '').toLowerCase().includes('xuân đỉnh') || (room.address || '').toLowerCase().includes('cổ nhuế'))) matchSource = true;
        else if (sg === 'nguon-dinh-cong' && (rsg.includes('dinh-cong') || (room.address || '').toLowerCase().includes('định công'))) matchSource = true;
        else if (sg === 'nguon-dong-da' && (rsg.includes('dong-da') || rDist === 'dong-da')) matchSource = true;
        else if (sg === 'nguon-ha-dong' && (rsg.includes('ha-dong') || rDist === 'ha-dong')) matchSource = true;
        else if (sg === 'nguon-hoang-mai' && (rsg.includes('hoang-mai') || rDist === 'hoang-mai')) matchSource = true;
        else if (sg === 'nguon-kim-giang-ngoc-hoi' && (rsg.includes('kim-giang') || rDist === 'thanh-tri' || (room.address || '').toLowerCase().includes('kim giang') || (room.address || '').toLowerCase().includes('ngọc hồi'))) matchSource = true;
        else if (sg === 'me-tri-phu-do' && (rsg.includes('me-tri') || (room.address || '').toLowerCase().includes('mễ trì') || (room.address || '').toLowerCase().includes('phú đô'))) matchSource = true;
        else if (sg === 'nguon-my-dinh' && (rsg.includes('my-dinh') || (room.address || '').toLowerCase().includes('mỹ đình'))) matchSource = true;
        else if (sg === 'nguon-nam-tu-liem' && (rsg.includes('nam-tu-liem') || rDist === 'nam-tu-liem')) matchSource = true;
        else if (sg === 'nguon-phu-dien' && (rsg.includes('phu-dien') || (room.address || '').toLowerCase().includes('phú diễn'))) matchSource = true;
        else if (sg === 'nguon-tay-ho' && (rsg.includes('tay-ho') || rDist === 'tay-ho')) matchSource = true;
        else if (sg === 'nguon-thanh-xuan' && (rsg.includes('thanh-xuan') || rDist === 'thanh-xuan')) matchSource = true;
        else if (sg === 'nguon-trieu-khuc' && (rsg.includes('trieu-khuc') || (room.address || '').toLowerCase().includes('triều khúc'))) matchSource = true;
        else if (sg === 'nguon-xuan-phuong' && (rsg.includes('xuan-phuong') || (room.address || '').toLowerCase().includes('xuân phương'))) matchSource = true;
        else if (sg === 'nguon-yen-xa-mau-luong' && (rsg.includes('yen-xa') || (room.address || '').toLowerCase().includes('yên xá') || (room.address || '').toLowerCase().includes('mậu lương'))) matchSource = true;
        else if (sg === 'nguon-hoai-duc' && (rsg.includes('hoai-duc') || rDist === 'hoai-duc')) matchSource = true;
        else if (sg === 'nguon-ho-tung-mau' && ((room.address || '').toLowerCase().includes('hồ tùng mậu'))) matchSource = true;
        else if (sg === 'ngoc-truc-dai-linh' && ((room.address || '').toLowerCase().includes('ngọc trục') || (room.address || '').toLowerCase().includes('đại linh'))) matchSource = true;
      }
      if (!matchSource) return false;
    }

    // 4. Room Type
    if (currentFilter.roomType !== "all" && room.roomType !== currentFilter.roomType) {
      return false;
    }

    // 5. Price Range (Top select)
    if (currentFilter.priceRange !== "all") {
      const range = PRICE_RANGES.find(p => p.id === currentFilter.priceRange);
      if (range) {
        if (room.price < range.min || room.price > range.max) return false;
      }
    }

    // 6. Custom Price Range (Từ... Đến...)
    if (currentFilter.minPrice !== null && !isNaN(currentFilter.minPrice) && room.price < currentFilter.minPrice) {
      return false;
    }
    if (currentFilter.maxPrice !== null && !isNaN(currentFilter.maxPrice) && room.price > currentFilter.maxPrice) {
      return false;
    }

    // 7. Chỉ hiển thị tin yêu thích
    if (currentFilter.onlyFavorites && !wishlist.includes(room.id)) {
      return false;
    }

    // 8. Dạng phòng (Studio, 1N1K, 2N1K, 3N1K)
    if (currentFilter.roomLayout !== "all") {
      const targetLayout = currentFilter.roomLayout.toLowerCase();
      const actualLayout = (room.roomLayout || "").toLowerCase();
      const title = (room.title || "").toLowerCase();
      const tag = (room.tag || "").toLowerCase();
      if (!actualLayout.includes(targetLayout) && !title.includes(targetLayout) && !tag.includes(targetLayout)) {
        return false;
      }
    }

    // 9. Sức chứa
    if (currentFilter.capacity !== "all") {
      const reqCap = parseInt(currentFilter.capacity, 10);
      if ((room.maxPeople || 2) < reqCap) return false;
    }

    // 10. Để xe
    if (currentFilter.vehicles !== "all") {
      const reqVeh = parseInt(currentFilter.vehicles, 10);
      if ((room.maxVehicles || 2) < reqVeh) return false;
    }

    // 11. Loại thang (Thang máy / Thang bộ)
    if (currentFilter.elevator === "elevator" && !room.elevator) return false;
    if (currentFilter.elevator === "stairs" && room.elevator) return false;

    // 12. Thú cưng
    if (currentFilter.pet === "allowed" && !room.petAllowed) return false;
    if (currentFilter.pet === "forbidden" && room.petAllowed) return false;

    // 13. Xe điện & Xe điện VinFast
    if (currentFilter.evAllowed || currentFilter.evVin || currentFilter.evForbidden) {
      let matchEv = false;
      const policy = room.electricVehiclePolicy || (room.electricVehicle ? 'allowed' : 'forbidden');
      const note = (room.electricVehicleNote || '').toLowerCase();

      // Nếu chọn "Nhận xe điện (Chung)"
      if (currentFilter.evAllowed && (policy === 'allowed' || room.electricVehicle)) {
        matchEv = true;
      }
      // Nếu chọn "Xe điện VinFast / Đổi pin"
      if (currentFilter.evVin && (policy === 'vinfast_only' || note.includes('vin') || (policy === 'allowed' && room.electricVehicle))) {
        matchEv = true;
      }
      // Nếu chọn "Cấm xe điện"
      if (currentFilter.evForbidden && (policy === 'forbidden' || !room.electricVehicle)) {
        matchEv = true;
      }
      if (!matchEv) return false;
    } else if (currentFilter.electricVehicle === "allowed" && !room.electricVehicle) {
      return false;
    } else if (currentFilter.electricVehicle === "forbidden" && room.electricVehicle) {
      return false;
    }

    // 14. Khách quốc tế
    if (currentFilter.foreignGuest === "allowed" && !room.foreignGuest) return false;
    if (currentFilter.foreignGuest === "forbidden" && room.foreignGuest) return false;

    // 15. Thuận tiện ô tô
    if (currentFilter.nearParking && !room.nearParking) return false;
    if (currentFilter.nearMainRoad && !room.nearMainRoad) return false;

    // 16. Gác xép
    if (currentFilter.loft !== "all") {
      const hasLoft = (room.roomLayout === "Gác lửng") || 
                      (room.tag && room.tag.toLowerCase().includes("gác")) ||
                      (room.title && room.title.toLowerCase().includes("gác")) ||
                      ((room.amenities || []).some(a => a.toLowerCase().includes("gác")));
      if (currentFilter.loft === "has_loft" && !hasLoft) return false;
      if (currentFilter.loft === "no_loft" && hasLoft) return false;
    }

    // 17. Có gì trong nhà? (Tiện nghi)
    if (currentFilter.amenities && currentFilter.amenities.length > 0) {
      const roomAmenities = (room.amenities || []).map(a => a.toLowerCase());
      const hasAll = currentFilter.amenities.every(reqAmenity => 
        roomAmenities.some(ra => ra.includes(reqAmenity.toLowerCase()))
      );
      if (!hasAll) return false;
    }

    return true;
  }).sort((a, b) => {
    if (currentFilter.sortBy === "price-asc") return a.price - b.price;
    if (currentFilter.sortBy === "price-desc") return b.price - a.price;
    if (currentFilter.sortBy === "area-desc") return b.area - a.area;
    return (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
  });
}

// ==========================================================================
// WISHLIST MANAGEMENT
// ==========================================================================
function toggleWishlist(roomId, event) {
  if (event) event.stopPropagation();
  const index = wishlist.indexOf(roomId);
  if (index === -1) {
    wishlist.push(roomId);
    showToast("Đã lưu phòng vào danh sách yêu thích ❤️");
  } else {
    wishlist.splice(index, 1);
    showToast("Đã bỏ phòng khỏi danh sách yêu thích");
  }
  localStorage.setItem(STORAGE_WISHLIST_KEY, JSON.stringify(wishlist));
  updateWishlistCount();
  renderRooms();
}

function updateWishlistCount() {
  const badge = document.getElementById("wishlistCountBadge");
  if (badge) {
    badge.innerText = wishlist.length;
    badge.style.display = wishlist.length > 0 ? "flex" : "none";
  }
}

function openWishlistModal() {
  const savedRooms = rooms.filter(r => wishlist.includes(r.id));
  const container = document.getElementById("wishlistModalBody");
  
  if (!container) return;

  if (savedRooms.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px 20px;">
        <i class="far fa-heart" style="font-size: 3rem; color: var(--text-light); margin-bottom: 12px;"></i>
        <h4 style="font-size: 1.2rem; color: var(--dark);">Chưa có phòng nào được lưu</h4>
        <p style="color: var(--text-muted); font-size: 0.9rem;">Hãy bấm biểu tượng trái tim ở góc ảnh phòng để lưu lại xem sau nhé!</p>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 14px;">
        ${savedRooms.map(room => `
          <div style="display: flex; gap: 16px; align-items: center; background: var(--bg-alt); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
            <img src="${room.images[0]}" style="width: 80px; height: 70px; object-fit: cover; border-radius: var(--radius-sm); cursor: pointer;" alt="${room.title}" onclick="closeModal('wishlistModal'); openRoomDetailModal('${room.id}', true);">
            <div style="flex-grow: 1; cursor: pointer;" onclick="closeModal('wishlistModal'); openRoomDetailModal('${room.id}', true);">
              <h5 style="font-size: 0.95rem; font-weight: 700; color: var(--dark); margin-bottom: 4px;">${room.title}</h5>
              <div style="font-size: 0.82rem; color: var(--text-muted); margin-bottom: 4px;">${room.address}</div>
              <div style="font-weight: 800; color: var(--accent); font-size: 0.95rem;">${new Intl.NumberFormat('vi-VN').format(room.price)} đ/tháng</div>
            </div>
            <div style="display: flex; gap: 8px;">
              <button class="btn-schedule-view" style="padding: 8px 14px; font-size: 0.82rem; background: #0068FF;" onclick="closeModal('wishlistModal'); contactZaloRoom('${room.id}')">
                <i class="fas fa-comment-dots"></i> Nhắn Zalo
              </button>
              <button style="background: white; border: 1px solid var(--border-color); color: var(--danger); width: 34px; height: 34px; border-radius: var(--radius-sm); cursor: pointer;" onclick="toggleWishlist('${room.id}'); openWishlistModal();">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
        `).join("")}
      </div>
    `;
  }

  openModal("wishlistModal");
}

// ==========================================================================
// ROOM DETAIL MODAL CHUẨN MOITHUE.COM (ĐẦY ĐỦ THẺ TAG + 4 PHẦN MÔ TẢ)
// ==========================================================================
let currentDetailRoom = null;

function getTimeAgo(dateStr) {
  if (!dateStr) return "Gần đây";
  const now = new Date();
  const created = new Date(dateStr);
  const diffMs = now - created;
  const diffH = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffH < 1) return "Vừa đăng";
  if (diffH < 24) return diffH + " giờ trước";
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return diffD + " ngày trước";
  return Math.floor(diffD / 7) + " tuần trước";
}

function buildAttributeTags(room) {
  const tags = [];
  // Nhóm nguồn hàng (thay cho HH)
  if (room.sourceGroupName) {
    const shortName = room.sourceGroupName.replace("Khu vực ", "");
    tags.push({ text: shortName, highlight: true });
  }
  // Loại nhà thuê
  if (room.categoryName) tags.push({ text: room.categoryName.split("(")[0].trim() });
  // Dạng phòng
  if (room.roomLayout) tags.push({ text: room.roomLayout });
  // Tình trạng
  if (room.moveInStatus) tags.push({ text: room.moveInStatus });
  // Diện tích
  tags.push({ text: room.area + " m²" });
  // Thang máy
  if (room.elevator) tags.push({ text: "Thang máy" });
  // Mức nội thất
  if (room.furnishLevel) tags.push({ text: room.furnishLevel });
  // Tối đa
  tags.push({ text: room.maxPeople + " người" });
  // Xe
  if (room.maxVehicles) tags.push({ text: room.maxVehicles + " xe" });
  // Pet
  tags.push({ text: room.petAllowed ? "✅ Nhận pet" : "🚫 Không nuôi pet" });
  // Xe điện & VinFast
  if (room.electricVehiclePolicy === 'vinfast_only') {
    tags.push({ text: "🛵 Nhận xe VinFast (đổi pin)", highlight: true });
  } else if (room.electricVehiclePolicy === 'allowed' || room.electricVehicle) {
    tags.push({ text: "⚡ Nhận xe điện" });
  } else if (room.electricVehiclePolicy === 'forbidden' || room.electricVehicle === false) {
    tags.push({ text: "🚫 Cấm xe điện" });
  }
  // Khách quốc tế
  tags.push({ text: room.foreignGuest ? "✅ Nhận khách quốc tế" : "🚫 Không khách quốc tế" });
  // Gần bãi đỗ
  if (room.nearParking) tags.push({ text: "Gần bãi đỗ ô tô" });
  // Gần đường lớn
  if (room.nearMainRoad) tags.push({ text: "Gần đường lớn" });

  return tags.map((t, idx) => `
    <div class="listing-attr-tag ${idx === 0 && t.highlight ? 'listing-attr-tag--primary' : ''}">
      ${t.text}
    </div>
  `).join("");
}

function formatDescContent(text) {
  if (!text) return '';
  // Clean html artifacts
  let clean = text
    .replace(/<span[^>]*>/gi, '')
    .replace(/<\/span>/gi, '')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<\/p>/gi, '\n')
    .replace(/<div[^>]*>/gi, '')
    .replace(/<\/div>/gi, '\n')
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#8211;/g, '–')
    .replace(/&#8230;/g, '...')
    .replace(/&hellip;/g, '...')
    .replace(/\[\.\.\.\]/g, '')
    .trim();

  // Split lines and render
  let lines = clean.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // Loại bỏ các dòng tiêu đề bị lặp thừa ở đầu nội dung
  lines = lines.filter((line, idx) => {
    if (idx < 2) {
      if (/^(?:📋\s*)?THÔNG TIN PHÒNG(_[A-Z0-9]+)?\s*$/i.test(line)) return false;
      if (/^(?:✅\s*)?TIỆN ÍCH\s*$/i.test(line)) return false;
      if (/^(?:🚚|🏆\s*)?DỊCH VỤ\s*$/i.test(line)) return false;
      if (/^(?:❎\s*)?LƯU Ý\s*$/i.test(line)) return false;
    }
    return true;
  });

  return lines.map(line => {
    if (/^[•—\-*]/.test(line)) {
      return `<div style="display: flex; gap: 8px; margin-bottom: 6px; align-items: baseline;"><span style="color: var(--primary); font-weight: 800;">•</span><span>${line.replace(/^[•—\-*]\s*/, '')}</span></div>`;
    }
    if (/^(?:🍡|🛋️|⏳|✅|🚚|❎|📋)/u.test(line)) {
      return `<div style="margin-bottom: 6px; font-weight: 500;">${line}</div>`;
    }
    return `<div style="margin-bottom: 6px;">${line}</div>`;
  }).join('');
}

function openRoomDetailModal(roomId, isFullscreen = true, event) {
  if (event) event.stopPropagation();

  const room = rooms.find(r => r.id === roomId);
  if (!room) return;
  currentDetailRoom = room;

  const modal = document.getElementById("roomDetailModal");
  if (!modal) return;

  const content = document.getElementById("roomDetailContent");
  if (!content) return;

  const topbarTitle = document.getElementById("topbarRoomTitle");
  if (topbarTitle) {
    topbarTitle.innerText = room.title || "Chi tiết phòng trọ";
  }

  // Khởi tạo chế độ Toàn màn hình hoặc Thu nhỏ (Xem nhanh)
  const toggleBtn = document.getElementById("detailFullscreenToggleBtn");
  if (isFullscreen) {
    modal.classList.add("modal-fullscreen");
    if (toggleBtn) toggleBtn.innerHTML = `<i class="fas fa-compress-alt"></i> <span>Thu nhỏ</span>`;
  } else {
    modal.classList.remove("modal-fullscreen");
    if (toggleBtn) toggleBtn.innerHTML = `<i class="fas fa-expand-alt"></i> <span>Toàn màn hình</span>`;
  }

  const priceFormatted = new Intl.NumberFormat('vi-VN').format(room.price) + " đ";
  const timeAgo = getTimeAgo(room.createdAt);
  const dd = room.detailDescription || {};

  // Auto-fill missing sections if any are empty
  const descText = room.description || '';
  let serviceContent = dd.service || '';
  if (!serviceContent) {
    const sMatch = descText.match(/(?:(?:🚚|🏆)\s*DỊCH VỤ|DỊCH VỤ\s*:)[\s\S]*?(?=(?:❎\s*LƯU Ý|LƯU Ý\s*:|$))/i);
    if (sMatch) serviceContent = sMatch[0];
    else if (room.feeElectricity || room.feeWater) {
      serviceContent = `🚚 DỊCH VỤ\n• Điện: ${room.feeElectricity || '4k/số'}\n• Nước: ${room.feeWater || '30k/khối'}\n• Mạng wifi: ${room.feeInternet || '100k/phòng'}\n• Dịch vụ chung: ${room.feeService || '150k/người'}\n• Xe máy: ${room.feeParking || 'Free 2 xe'}`;
    }
  }

  let noteContent = dd.note || '';
  if (!noteContent) {
    const nMatch = descText.match(/(?:❎\s*LƯU Ý|LƯU Ý\s*:)[\s\S]*$/i);
    if (nMatch) noteContent = nMatch[0];
    else if (room.maxPeople) {
      noteContent = `❎ LƯU Ý\n• Tối đa: ${room.maxPeople} người ${room.maxVehicles || 2} xe\n• Nuôi pet: ${room.petAllowed ? 'Cho phép' : 'Không'}\n• Xe điện: ${room.electricVehicleNote || 'Liên hệ'}\n• Khách tây: ${room.foreignGuest ? 'Có' : 'Không'}\n• Giờ giấc: Tự do\n• Hợp đồng: ${room.contractTerm || '12 tháng'}\n• Thanh toán: ${room.depositTerm || 'Cọc 1 đóng 1'}`;
    }
  }

  // Available floors
  let floors = room.availableFloors || [];
  if (floors.length === 0) {
    const titleRoomMatch = room.title ? room.title.match(/(?:_|\s)(\d{3}(?:\s*,\s*\d{3})+)/) : null;
    if (titleRoomMatch) {
      floors = titleRoomMatch[1].split(',').map(n => 'P.' + n.trim());
    } else {
      const floorTags = descText.match(/(?:P\.?\s*\d+|Tầng\s*\d+)/gi);
      if (floorTags && floorTags.length > 0) {
        floors = Array.from(new Set(floorTags.map(f => f.trim())));
      }
    }
  }

  // Amenities
  const allAmenities = (room.amenities && room.amenities.length > 0) ? room.amenities : [
    'Ban công', 'Điều hòa', 'Nóng lạnh', 'Giường', 'Tủ quần áo', 'Bàn bếp', 'Tủ bếp', 'Wifi', 'Máy giặt chung', 'Thang thoát hiểm'
  ];

  // Video URL
  let ytUrl = room.videoUrl || '';
  if (!ytUrl) {
    const ytInDesc = descText.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
    if (ytInDesc) ytUrl = `https://www.youtube.com/watch?v=${ytInDesc[1]}`;
  }
  const driveUrl = room.videoDriveUrl || '';

  content.innerHTML = `
    <!-- Gallery -->
    <div class="detail-gallery">
      <div class="detail-gallery-main" style="position: relative;">
        <img src="${room.images[0]}" id="detailMainImg" alt="${room.title}" referrerpolicy="no-referrer" onerror="this.onerror=null; this.src='${DEFAULT_ROOM_IMAGE}'">
        <div class="gallery-photo-count" style="position: absolute; bottom: 12px; right: 12px; background: rgba(0,0,0,0.75); color: white; padding: 6px 14px; border-radius: 20px; font-weight: 700; font-size: 0.85rem; backdrop-filter: blur(4px);">
          <i class="fas fa-images"></i> ${room.images.length} ảnh phòng thực tế
        </div>
      </div>
      <div class="detail-gallery-thumbs" style="display: flex; gap: 8px; overflow-x: auto; padding: 6px 0;">
        ${room.images.map((img, idx) => `
          <img src="${img}" class="thumb-img ${idx === 0 ? 'active' : ''}" onclick="switchDetailImg('${img}', this)" alt="Ảnh phòng ${idx + 1}" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null; this.src='${DEFAULT_ROOM_IMAGE}'" style="width: 80px; height: 60px; object-fit: cover; border-radius: 6px; cursor: pointer; border: 2px solid ${idx === 0 ? 'var(--primary)' : 'transparent'}; flex-shrink: 0;">
        `).join("")}
      </div>
    </div>

    <!-- Stats Bar -->
    <div class="detail-stats-bar" style="display: flex; justify-content: space-between; color: var(--text-muted); font-size: 0.85rem; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid var(--border-color);">
      <div class="detail-stat">
        <i class="far fa-clock"></i> Đăng: ${timeAgo}
      </div>
      <div class="detail-stat">
        <i class="far fa-eye"></i> ${room.views || 1} Lượt xem · Mã tin: <strong>${room.id}</strong>
      </div>
    </div>

    <!-- === BANNER LƯU Ý CHÍNH SÁCH QUAN TRỌNG (CHUẨN MOITHUE) === -->
    <div class="notice-sale-banner" style="background: #FEFCE8; border: 1.5px solid #FDE047; border-radius: 10px; padding: 12px 18px; margin-bottom: 18px; font-size: 0.92rem; color: #854D0E; line-height: 1.6; box-shadow: 0 2px 6px rgba(253, 224, 71, 0.15);">
      <div style="font-weight: 800; display: flex; align-items: center; gap: 8px; margin-bottom: 6px; color: #A16207; font-size: 0.95rem;">
        <i class="fas fa-bell" style="color: #D97706; font-size: 1.05rem;"></i> 🚨 LƯU Ý VỀ CHÍNH SÁCH & PHÍ DỊCH VỤ
      </div>
      <div style="display: flex; flex-wrap: wrap; gap: 10px 18px; margin-top: 6px;">
        <span style="display: inline-flex; align-items: center; gap: 6px; font-weight: 700; color: #15803D;">
          <i class="fas fa-check-circle" style="color: #16A34A;"></i> ${room.feeParking === 'Free' || (room.feeParking && room.feeParking.toLowerCase().includes('free')) ? 'Miễn phí xe máy' : 'Phí xe: ' + (room.feeParking || 'Theo quy định')}
        </span>
        <span style="display: inline-flex; align-items: center; gap: 6px; font-weight: 700; color: ${room.petAllowed ? '#15803D' : '#DC2626'};">
          <i class="${room.petAllowed ? 'fas fa-paw' : 'fas fa-ban'}"></i> ${room.petAllowed ? 'Cho phép nuôi pet' : 'Không nuôi thú cưng'}
        </span>
        <span style="display: inline-flex; align-items: center; gap: 6px; font-weight: 700; color: ${room.electricVehicle ? '#15803D' : '#DC2626'};">
          <i class="${room.electricVehicle ? 'fas fa-bolt' : 'fas fa-ban'}"></i> ${room.electricVehiclePolicy === 'vinfast_only' ? 'Nhận xe VinFast đổi pin' : (room.electricVehicle ? 'Nhận xe điện' : 'Cấm xe điện')}
        </span>
        <span style="display: inline-flex; align-items: center; gap: 6px; font-weight: 700; color: ${room.foreignGuest ? '#15803D' : '#64748B'};">
          <i class="${room.foreignGuest ? 'fas fa-globe' : 'fas fa-user-slash'}"></i> ${room.foreignGuest ? 'Nhận khách quốc tế' : 'Không khách quốc tế'}
        </span>
      </div>
    </div>

    <!-- Title & Price -->
    <div class="detail-header-info">
      <div style="flex: 1;">
        <h2 class="detail-title" style="font-size: 1.5rem; font-weight: 800; color: #0F172A; line-height: 1.3;">${room.title}</h2>
        <div style="color: #64748B; font-size: 0.95rem; display: flex; align-items: center; gap: 6px; margin-top: 6px;">
          <i class="fas fa-map-marker-alt" style="color: var(--primary);"></i>
          <span>${room.address}</span>
        </div>
      </div>
      <div class="detail-price-box" style="background: #F0FDF4; border: 1px solid #BBF7D0; padding: 10px 20px; border-radius: 10px; text-align: right;">
        <div class="detail-price" style="color: #15803D; font-size: 1.6rem; font-weight: 900;">${priceFormatted}</div>
        <div style="font-size: 0.82rem; color: #166534; font-weight: 600;">/ tháng</div>
      </div>
    </div>

    <!-- === DẢI THẺ TAG THUỘC TÍNH (CHUẨN MOITHUE) === -->
    <div class="listing-attr-tags-strip" style="margin-bottom: 20px;">
      ${buildAttributeTags(room)}
    </div>

    <!-- === TẦNG CÒN PHÒNG Ở TRỤC NÀY (CHUẨN 100% MOITHUE) === -->
    ${(floors && floors.length > 0) ? `
    <div class="available-floors-section">
      <h4 class="modal-section-title" style="margin-bottom: 8px; color: #92400E; font-size: 1.05rem; font-weight: 800;">
        <i class="fas fa-layer-group" style="color: #F59E0B;"></i> ✅ Tầng còn phòng ở trục này
      </h4>
      <div class="floor-tags">
        ${floors.map(f => `<span class="floor-tag"><i class="fas fa-check-circle"></i> ${f}</span>`).join("")}
      </div>
    </div>
    ` : ''}

    <!-- === VIDEO PHÒNG (YOUTUBE EMBED HOẶC LINK GOOGLE DRIVE) === -->
    ${(ytUrl || driveUrl) ? `
    <div style="margin-bottom: 24px;">
      <h4 class="modal-section-title" style="font-size: 1.05rem; font-weight: 800; color: #0F172A; margin-bottom: 10px;">
        <i class="fab fa-youtube" style="color: #EF4444; font-size: 1.3rem;"></i> Video thực tế căn phòng
      </h4>
      ${ytUrl ? `
      <div class="video-embed-wrapper" style="margin-bottom: 10px;">
        <iframe src="${ytUrl.replace('watch?v=', 'embed/').replace('youtu.be/', 'www.youtube.com/embed/').replace('youtube.com/shorts/', 'youtube.com/embed/')}" 
          frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
      </div>
      ` : ''}
      ${driveUrl ? `
      <div>
        <a href="${driveUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 8px; background: #EFF6FF; border: 1.5px solid #3B82F6; color: #1D4ED8; padding: 10px 18px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 0.92rem; box-shadow: 0 2px 6px rgba(59, 130, 246, 0.15);">
          <i class="fab fa-google-drive" style="font-size: 1.25rem; color: #2563EB;"></i> 🎬 Xem & Tải video gốc phòng này (Google Drive)
        </a>
      </div>
      ` : ''}
    </div>
    ` : ''}

    <!-- === MÔ TẢ 4 PHẦN ĐẦY ĐỦ 100% CHUẨN MOITHUE === -->
    <div class="detail-description-sections" style="margin-bottom: 26px;">
      <h4 class="modal-section-title" style="font-size: 1.15rem; font-weight: 800; color: #0F172A; margin-bottom: 14px;">
        <i class="fas fa-file-alt" style="color: var(--primary);"></i> Mô tả chi tiết 4 phần
      </h4>

      <!-- PHẦN 1: THÔNG TIN PHÒNG -->
      <div class="desc-section" style="margin-bottom: 14px; border-radius: 10px; border: 1px solid #E2E8F0; overflow: hidden; background: #FAFAFA;">
        <div class="desc-section-header" style="background: white; padding: 12px 18px; font-weight: 800; font-size: 0.98rem; color: #0F172A; border-bottom: 1px solid #E2E8F0; display: flex; align-items: center; gap: 8px;">
          <span class="desc-section-icon" style="font-size: 1.15rem;">📋</span> THÔNG TIN PHÒNG
        </div>
        <div class="desc-section-body" style="padding: 14px 18px; font-size: 0.92rem; line-height: 1.8; color: #334155;">
          ${formatDescContent(dd.info || `ĐỊA CHỈ: ${room.address}\nDiện tích: ${room.area}m2\nDạng phòng: ${room.roomLayout}\nThang máy: ${room.elevator ? 'Có' : 'Không'}\nNội thất: ${room.furniture || 'Full đồ'}`)}
        </div>
      </div>

      <!-- PHẦN 2: TIỆN ÍCH -->
      <div class="desc-section" style="margin-bottom: 14px; border-radius: 10px; border: 1px solid #E2E8F0; overflow: hidden; background: #FAFAFA;">
        <div class="desc-section-header" style="background: white; padding: 12px 18px; font-weight: 800; font-size: 0.98rem; color: #0F172A; border-bottom: 1px solid #E2E8F0; display: flex; align-items: center; gap: 8px;">
          <span class="desc-section-icon" style="font-size: 1.15rem;">✅</span> TIỆN ÍCH
        </div>
        <div class="desc-section-body" style="padding: 14px 18px; font-size: 0.92rem; line-height: 1.8; color: #334155;">
          ${formatDescContent(dd.amenity || 'Gần chợ dân sinh, siêu thị, bãi đỗ ô tô và các trường đại học lớn trong khu vực.')}
        </div>
      </div>

      <!-- PHẦN 3: DỊCH VỤ -->
      <div class="desc-section" style="margin-bottom: 14px; border-radius: 10px; border: 1px solid #E2E8F0; overflow: hidden; background: #FAFAFA;">
        <div class="desc-section-header" style="background: white; padding: 12px 18px; font-weight: 800; font-size: 0.98rem; color: #0F172A; border-bottom: 1px solid #E2E8F0; display: flex; align-items: center; gap: 8px;">
          <span class="desc-section-icon" style="font-size: 1.15rem;">🚚</span> DỊCH VỤ
        </div>
        <div class="desc-section-body" style="padding: 14px 18px; font-size: 0.92rem; line-height: 1.8; color: #334155;">
          ${formatDescContent(serviceContent)}
        </div>
      </div>

      <!-- PHẦN 4: LƯU Ý -->
      <div class="desc-section" style="margin-bottom: 14px; border-radius: 10px; border: 1px solid #E2E8F0; overflow: hidden; background: #FAFAFA;">
        <div class="desc-section-header" style="background: white; padding: 12px 18px; font-weight: 800; font-size: 0.98rem; color: #0F172A; border-bottom: 1px solid #E2E8F0; display: flex; align-items: center; gap: 8px;">
          <span class="desc-section-icon" style="font-size: 1.15rem;">❎</span> LƯU Ý
        </div>
        <div class="desc-section-body" style="padding: 14px 18px; font-size: 0.92rem; line-height: 1.8; color: #334155;">
          ${formatDescContent(noteContent)}
        </div>
      </div>
    </div>

    <!-- === TRONG NHÀ CÓ GÌ? (100% TIỆN NGHI CHUẨN GIAO DIỆN MOITHUE GỐC) === -->
    <div style="margin-bottom: 28px; padding: 22px; background: #F8FAFC; border-radius: 12px; border: 1px solid #E2E8F0;">
      <h3 style="font-size: 1.25rem; font-weight: 800; color: #0F172A; margin-bottom: 18px; display: flex; align-items: center; gap: 8px;">
        <i class="fas fa-couch" style="color: #F59E0B;"></i> Trong nhà có gì? (${allAmenities.length} tiện nghi)
      </h3>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px 20px;">
        ${allAmenities.map(a => `
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 24px; height: 24px; min-width: 24px; border-radius: 50%; background: #F59E0B; color: white; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 900; box-shadow: 0 2px 4px rgba(245, 158, 11, 0.35);">
              <i class="fas fa-check"></i>
            </div>
            <span style="font-size: 0.95rem; font-weight: 600; color: #1E293B;">${a}</span>
          </div>
        `).join("")}
      </div>
    </div>

    <!-- CTA Footer -->
    <div style="display: flex; gap: 12px; align-items: center; justify-content: flex-end; padding-top: 18px; border-top: 1px solid var(--border-color); flex-wrap: wrap;">
      <a href="tel:${CONSULTANT_PHONE}" class="btn-hotline" style="text-decoration: none; padding: 12px 22px; font-weight: 700; border-radius: 8px; display: inline-flex; align-items: center; gap: 8px; background: #F1F5F9; color: #0F172A; border: 1px solid #CBD5E1;">
        <i class="fas fa-phone-alt" style="color: var(--primary);"></i> Gọi Ad Tuyển: 0358.954.360
      </a>
      <button class="btn-schedule-view" style="padding: 12px 26px; font-size: 0.98rem; font-weight: 800; border-radius: 8px; border: none; cursor: pointer; color: white; background: linear-gradient(135deg, #0068FF, #0052cc); box-shadow: 0 4px 14px rgba(0, 104, 255, 0.35); display: inline-flex; align-items: center; gap: 8px;" onclick="contactZaloRoom('${room.id}')">
        <i class="fas fa-comment-dots"></i> Nhắn Zalo lên lịch hẹn với Ad
      </button>
    </div>
  `;

  openModal("roomDetailModal");
}

function switchDetailImg(imgSrc, thumbEl) {
  const mainImg = document.getElementById('detailMainImg');
  if (mainImg) mainImg.src = imgSrc;
  document.querySelectorAll('.thumb-img').forEach(t => {
    t.classList.remove('active');
    t.style.borderColor = 'transparent';
  });
  if (thumbEl) {
    thumbEl.classList.add('active');
    thumbEl.style.borderColor = 'var(--primary)';
  }
}

// ==========================================================================
// CONTACT VIA ZALO ĐỂ LÊN LỊCH HẸN VỚI AD
// ==========================================================================
function contactZaloRoom(roomId, event) {
  if (event) event.stopPropagation();

  const room = (typeof rooms !== 'undefined' && rooms) ? rooms.find(r => r.id === roomId) : null;
  const roomTitle = room ? room.title : "phòng trọ";

  showToast(`Đang chuyển hướng Zalo tới Ad Đặng Văn Tuyển (0358.954.360) để lên lịch hẹn...`);
  
  // Mở Zalo trực tiếp tới chuyên viên Đặng Văn Tuyển
  window.open(`https://zalo.me/0358954360`, "_blank");
}

// ==========================================================================
// MODAL CONTROLLERS & EVENT LISTENERS
// ==========================================================================
function toggleModalFullscreen() {
  const modal = document.getElementById("roomDetailModal");
  if (!modal) return;
  const isFs = modal.classList.toggle("modal-fullscreen");
  const toggleBtn = document.getElementById("detailFullscreenToggleBtn");
  if (toggleBtn) {
    toggleBtn.innerHTML = isFs 
      ? `<i class="fas fa-compress-alt"></i> <span>Thu nhỏ</span>`
      : `<i class="fas fa-expand-alt"></i> <span>Toàn màn hình</span>`;
  }
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add("active");
    document.body.style.overflow = "hidden";
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove("active");
    modal.classList.remove("modal-fullscreen");
    document.body.style.overflow = "auto";
  }
}

window.onclick = function(event) {
  if (event.target.classList.contains("modal-overlay")) {
    event.target.classList.remove("active");
    event.target.classList.remove("modal-fullscreen");
    document.body.style.overflow = "auto";
  }
};

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeModal("roomDetailModal");
    closeModal("wishlistModal");
  }
});

// ==========================================================================
// SEARCHABLE SELECTS (CHUẨN LISTIVO-SELECT-V2 MOITHUE.COM)
// ==========================================================================
function getDistrictCount(districtId) {
  if (!rooms || rooms.length === 0) return 0;
  if (districtId === 'all') return rooms.length;
  const target = districtId.replace(/^(quan-|huyen-)/, '').toLowerCase();
  return rooms.filter(r => {
    const rd = (r.district || '').replace(/^(quan-|huyen-)/, '').toLowerCase();
    return rd === target;
  }).length;
}

function getSourceGroupCount(sourceGroupId) {
  if (!rooms || rooms.length === 0) return 0;
  if (sourceGroupId === 'all') return rooms.length;
  return rooms.filter(r => (r.sourceGroup || '') === sourceGroupId).length;
}

function getDistrictItems() {
  return DISTRICTS.map(d => ({
    id: d.id,
    name: d.name,
    count: getDistrictCount(d.id)
  }));
}

function getSourceGroupItems() {
  return SOURCE_GROUPS.map(s => ({
    id: s.id,
    name: s.name,
    count: getSourceGroupCount(s.id)
  }));
}

function initSearchableSelects() {
  if (typeof SearchableSelect === 'undefined') return;

  const districtItems = getDistrictItems();
  const sourceGroupItems = getSourceGroupItems();

  // 1. Hero District Select
  const heroDistEl = document.getElementById('heroDistrictContainer');
  if (heroDistEl) {
    heroDistrictSelectComponent = new SearchableSelect({
      container: heroDistEl,
      placeholder: 'Quận / Huyện',
      iconHtml: '<i class="far fa-map"></i>',
      items: districtItems,
      value: currentFilter.district,
      onChange: (val) => {
        currentFilter.district = val;
        if (val !== 'all') {
          currentFilter.sourceGroup = 'all';
          if (heroSourceGroupSelectComponent) heroSourceGroupSelectComponent.setValue('all', false);
          if (sidebarSourceGroupSelectComponent) sidebarSourceGroupSelectComponent.setValue('all', false);
          const tags = document.querySelectorAll(".quick-tag-item");
          tags.forEach(t => t.classList.toggle("active", t.getAttribute("data-source") === "all"));
        }
        if (sidebarDistrictSelectComponent) sidebarDistrictSelectComponent.setValue(val, false);
        handleHeroSearch();
      }
    });
  }

  // 2. Hero Source Group Select
  const heroSrcEl = document.getElementById('heroSourceGroupContainer');
  if (heroSrcEl) {
    heroSourceGroupSelectComponent = new SearchableSelect({
      container: heroSrcEl,
      placeholder: 'Nhóm Nguồn Hàng',
      iconHtml: '<i class="far fa-building"></i>',
      items: sourceGroupItems,
      value: currentFilter.sourceGroup,
      onChange: (val) => {
        currentFilter.sourceGroup = val;
        if (val !== 'all') {
          currentFilter.district = 'all';
          if (heroDistrictSelectComponent) heroDistrictSelectComponent.setValue('all', false);
          if (sidebarDistrictSelectComponent) sidebarDistrictSelectComponent.setValue('all', false);
        }
        if (sidebarSourceGroupSelectComponent) sidebarSourceGroupSelectComponent.setValue(val, false);
        const tags = document.querySelectorAll(".quick-tag-item");
        tags.forEach(t => t.classList.toggle("active", t.getAttribute("data-source") === val));
        handleHeroSearch();
      }
    });
  }

  // 3. Sidebar District Select
  const sideDistEl = document.getElementById('sidebarDistrictContainer');
  if (sideDistEl) {
    sidebarDistrictSelectComponent = new SearchableSelect({
      container: sideDistEl,
      placeholder: 'Quận / Huyện',
      iconHtml: '<i class="far fa-map"></i>',
      items: districtItems,
      value: currentFilter.district,
      onChange: (val) => {
        currentFilter.district = val;
        if (val !== 'all') {
          currentFilter.sourceGroup = 'all';
          if (heroSourceGroupSelectComponent) heroSourceGroupSelectComponent.setValue('all', false);
          if (sidebarSourceGroupSelectComponent) sidebarSourceGroupSelectComponent.setValue('all', false);
          const tags = document.querySelectorAll(".quick-tag-item");
          tags.forEach(t => t.classList.toggle("active", t.getAttribute("data-source") === "all"));
        }
        if (heroDistrictSelectComponent) heroDistrictSelectComponent.setValue(val, false);
        onSidebarFilterChange();
      }
    });
  }

  // 4. Sidebar Source Group Select
  const sideSrcEl = document.getElementById('sidebarSourceGroupContainer');
  if (sideSrcEl) {
    sidebarSourceGroupSelectComponent = new SearchableSelect({
      container: sideSrcEl,
      placeholder: 'Nhóm Nguồn Hàng',
      iconHtml: '<i class="far fa-building"></i>',
      items: sourceGroupItems,
      value: currentFilter.sourceGroup,
      onChange: (val) => {
        currentFilter.sourceGroup = val;
        if (val !== 'all') {
          currentFilter.district = 'all';
          if (heroDistrictSelectComponent) heroDistrictSelectComponent.setValue('all', false);
          if (sidebarDistrictSelectComponent) sidebarDistrictSelectComponent.setValue('all', false);
        }
        if (heroSourceGroupSelectComponent) heroSourceGroupSelectComponent.setValue(val, false);
        const tags = document.querySelectorAll(".quick-tag-item");
        tags.forEach(t => t.classList.toggle("active", t.getAttribute("data-source") === val));
        onSidebarFilterChange();
      }
    });
  }
}

// ==========================================================================
// HERO SEARCH HANDLER (BỘ LỌC TÌM KIẾM CHÍNH TRANG CHỦ)
// ==========================================================================
function handleHeroSearch() {
  const searchInput = document.getElementById("heroSearchInput");
  const priceSelect = document.getElementById("heroPriceSelect");

  if (searchInput) currentFilter.keyword = searchInput.value.trim();
  if (priceSelect) currentFilter.priceRange = priceSelect.value;

  // Xử lý xung đột vị trí:
  // Nếu người dùng chọn cả Quận và Nhóm Nguồn Hàng (ví dụ Đống Đa + Cầu Diễn),
  // Kiểm tra xem Nguồn hàng đó có nằm trong Quận đó không:
  if (currentFilter.district !== "all" && currentFilter.sourceGroup !== "all") {
    const normD = currentFilter.district.replace(/^(quan-|huyen-)/, '');
    const hasOverlap = rooms.some(r => {
      const rd = (r.district || '').replace(/^(quan-|huyen-)/, '');
      return rd === normD && r.sourceGroup === currentFilter.sourceGroup;
    });

    if (!hasOverlap) {
      // Ưu tiên hiển thị toàn bộ phòng của Nhóm Nguồn Hàng được chọn (ví dụ Cầu Diễn có 14 phòng)
      currentFilter.district = "all";
      if (heroDistrictSelectComponent) heroDistrictSelectComponent.setValue('all', false);
      if (sidebarDistrictSelectComponent) sidebarDistrictSelectComponent.setValue('all', false);
    }
  }

  // Reset phân trang về trang 1
  currentPage = 1;

  renderRooms();

  // Tự động cuộn mượt mà xuống danh sách phòng để người dùng thấy ngay kết quả
  const el = document.getElementById("listingsSection");
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function initEventListeners() {
  const searchInput = document.getElementById("heroSearchInput");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      currentFilter.keyword = e.target.value;
      currentPage = 1;
      renderRooms();
    });
    searchInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        handleHeroSearch();
      }
    });
  }

  const typeSelect = document.getElementById("heroTypeSelect");
  if (typeSelect) {
    typeSelect.addEventListener("change", (e) => {
      currentFilter.roomType = e.target.value;
      updateFilterButtons(e.target.value);
      currentPage = 1;
      renderRooms();
    });
  }

  const priceSelect = document.getElementById("heroPriceSelect");
  if (priceSelect) {
    priceSelect.addEventListener("change", (e) => {
      currentFilter.priceRange = e.target.value;
      currentPage = 1;
      handleHeroSearch();
    });
  }

  const typeButtons = document.querySelectorAll(".filter-type-btn");
  typeButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      typeButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentFilter.roomType = btn.getAttribute("data-type");
      if (typeSelect) typeSelect.value = currentFilter.roomType;
      currentPage = 1;
      renderRooms();
    });
  });

  const sortSelect = document.getElementById("sortSelect");
  if (sortSelect) {
    sortSelect.addEventListener("change", (e) => {
      currentFilter.sortBy = e.target.value;
      currentPage = 1;
      renderRooms();
    });
  }
}

function updateFilterButtons(typeVal) {
  const typeButtons = document.querySelectorAll(".filter-type-btn");
  typeButtons.forEach(b => {
    b.classList.toggle("active", b.getAttribute("data-type") === typeVal);
  });
}

function setQuickDistrict(districtId) {
  currentFilter.district = districtId;
  currentFilter.sourceGroup = "all";
  currentPage = 1;

  if (heroDistrictSelectComponent) heroDistrictSelectComponent.setValue(districtId, false);
  if (sidebarDistrictSelectComponent) sidebarDistrictSelectComponent.setValue(districtId, false);
  if (heroSourceGroupSelectComponent) heroSourceGroupSelectComponent.setValue("all", false);
  if (sidebarSourceGroupSelectComponent) sidebarSourceGroupSelectComponent.setValue("all", false);

  const tags = document.querySelectorAll(".quick-tag-item");
  tags.forEach(t => t.classList.toggle("active", t.getAttribute("data-source") === "all"));

  renderRooms();
  const el = document.getElementById("listingsSection");
  if (el) el.scrollIntoView({ behavior: "smooth" });
}

function setQuickSource(sourceId) {
  currentFilter.sourceGroup = sourceId;
  currentFilter.district = "all";
  currentPage = 1;

  if (heroSourceGroupSelectComponent) heroSourceGroupSelectComponent.setValue(sourceId, false);
  if (sidebarSourceGroupSelectComponent) sidebarSourceGroupSelectComponent.setValue(sourceId, false);
  if (heroDistrictSelectComponent) heroDistrictSelectComponent.setValue("all", false);
  if (sidebarDistrictSelectComponent) sidebarDistrictSelectComponent.setValue("all", false);

  const tags = document.querySelectorAll(".quick-tag-item");
  tags.forEach(t => {
    t.classList.toggle("active", t.getAttribute("data-source") === sourceId);
  });

  renderRooms();
  const el = document.getElementById("listingsSection");
  if (el) el.scrollIntoView({ behavior: "smooth" });
}

function setQuickType(typeId) {
  currentFilter.roomType = typeId;
  currentPage = 1;
  const select = document.getElementById("heroTypeSelect");
  if (select) select.value = typeId;
  updateFilterButtons(typeId);
  
  const el = document.getElementById("listingsSection");
  if (el) el.scrollIntoView({ behavior: "smooth" });
  renderRooms();
}

function onSidebarFilterChange() {
  // 1. Only favorites
  const favEl = document.getElementById("filterOnlyFavorites");
  currentFilter.onlyFavorites = favEl ? favEl.checked : false;

  // 2. Room layout (radio)
  const layoutChecked = document.querySelector('input[name="sidebarRoomLayout"]:checked');
  currentFilter.roomLayout = layoutChecked ? layoutChecked.value : "all";

  // 3. Min / Max price
  const minPriceEl = document.getElementById("sidebarPriceMin");
  const maxPriceEl = document.getElementById("sidebarPriceMax");
  currentFilter.minPrice = minPriceEl && minPriceEl.value ? parseFloat(minPriceEl.value) : null;
  currentFilter.maxPrice = maxPriceEl && maxPriceEl.value ? parseFloat(maxPriceEl.value) : null;

  // 4. Capacity & Vehicles
  const capEl = document.getElementById("sidebarCapacity");
  currentFilter.capacity = capEl ? capEl.value : "all";

  const vehEl = document.getElementById("sidebarVehicles");
  currentFilter.vehicles = vehEl ? vehEl.value : "all";

  // 5. Elevator
  const elElevator = document.getElementById("filterElevator");
  const elStairs = document.getElementById("filterStairs");
  if (elElevator && elElevator.checked && (!elStairs || !elStairs.checked)) {
    currentFilter.elevator = "elevator";
  } else if (elStairs && elStairs.checked && (!elElevator || !elElevator.checked)) {
    currentFilter.elevator = "stairs";
  } else {
    currentFilter.elevator = "all";
  }

  // 6. Pet
  const elPetOk = document.getElementById("filterPetAllowed");
  const elPetNo = document.getElementById("filterPetForbidden");
  if (elPetOk && elPetOk.checked && (!elPetNo || !elPetNo.checked)) {
    currentFilter.pet = "allowed";
  } else if (elPetNo && elPetNo.checked && (!elPetOk || !elPetOk.checked)) {
    currentFilter.pet = "forbidden";
  } else {
    currentFilter.pet = "all";
  }

  // 7. EV & VinFast
  const elEvOk = document.getElementById("filterEVAllowed");
  const elEvVin = document.getElementById("filterEVVin");
  const elEvNo = document.getElementById("filterEVForbidden");

  currentFilter.evAllowed = elEvOk ? elEvOk.checked : false;
  currentFilter.evVin = elEvVin ? elEvVin.checked : false;
  currentFilter.evForbidden = elEvNo ? elEvNo.checked : false;

  // 8. Foreign guest
  const elForOk = document.getElementById("filterForeignAllowed");
  const elForNo = document.getElementById("filterForeignForbidden");
  if (elForOk && elForOk.checked && (!elForNo || !elForNo.checked)) {
    currentFilter.foreignGuest = "allowed";
  } else if (elForNo && elForNo.checked && (!elForOk || !elForOk.checked)) {
    currentFilter.foreignGuest = "forbidden";
  } else {
    currentFilter.foreignGuest = "all";
  }

  // 9. Car convenience
  const elNearPark = document.getElementById("filterNearParking");
  currentFilter.nearParking = elNearPark ? elNearPark.checked : false;

  const elNearRoad = document.getElementById("filterNearMainRoad");
  currentFilter.nearMainRoad = elNearRoad ? elNearRoad.checked : false;

  // 10. Loft / Gác xép
  const elLoftOk = document.getElementById("filterHasLoft");
  const elLoftNo = document.getElementById("filterNoLoft");
  if (elLoftOk && elLoftOk.checked && (!elLoftNo || !elLoftNo.checked)) {
    currentFilter.loft = "has_loft";
  } else if (elLoftNo && elLoftNo.checked && (!elLoftOk || !elLoftOk.checked)) {
    currentFilter.loft = "no_loft";
  } else {
    currentFilter.loft = "all";
  }

  // 11. Amenities
  const amenityCbs = document.querySelectorAll(".filter-amenity-cb:checked");
  currentFilter.amenities = Array.from(amenityCbs).map(cb => cb.value);

  currentPage = 1;
  renderRooms();
}

function updateSidebarCounts() {
  if (!rooms) return;
  const allCount = rooms.length;
  const studioCount = rooms.filter(r => (r.roomLayout || "").toLowerCase().includes("studio") || (r.title || "").toLowerCase().includes("studio")).length;
  const n1kCount = rooms.filter(r => (r.roomLayout || "").toLowerCase().includes("1n1k") || (r.title || "").toLowerCase().includes("1n1k")).length;
  const n2kCount = rooms.filter(r => (r.roomLayout || "").toLowerCase().includes("2n1k") || (r.title || "").toLowerCase().includes("2n1k")).length;
  const n3kCount = rooms.filter(r => (r.roomLayout || "").toLowerCase().includes("3n1k") || (r.title || "").toLowerCase().includes("3n1k")).length;

  const setBadge = (id, count) => {
    const el = document.getElementById(id);
    if (el) el.innerText = `(${count})`;
  };

  setBadge("countLayoutAll", allCount);
  setBadge("countLayoutStudio", studioCount);
  setBadge("countLayout1N1K", n1kCount);
  setBadge("countLayout2N1K", n2kCount);
  setBadge("countLayout3N1K", n3kCount);

  // Update dynamic counts in all SearchableSelect dropdowns
  const distItems = getDistrictItems();
  const srcItems = getSourceGroupItems();
  if (heroDistrictSelectComponent) heroDistrictSelectComponent.setItems(distItems);
  if (heroSourceGroupSelectComponent) heroSourceGroupSelectComponent.setItems(srcItems);
  if (sidebarDistrictSelectComponent) sidebarDistrictSelectComponent.setItems(distItems);
  if (sidebarSourceGroupSelectComponent) sidebarSourceGroupSelectComponent.setItems(srcItems);
}

function toggleSidebarFilter() {
  const sidebar = document.getElementById("sidebarFilter");
  if (sidebar) {
    sidebar.classList.toggle("active");
  }
}

function resetAllFilters() {
  currentFilter = {
    keyword: "",
    district: "all",
    sourceGroup: "all",
    roomType: "all",
    priceRange: "all",
    minPrice: null,
    maxPrice: null,
    sortBy: "newest",
    onlyFavorites: false,
    roomLayout: "all",
    capacity: "all",
    vehicles: "all",
    elevator: "all",
    pet: "all",
    electricVehicle: "all",
    evAllowed: false,
    evVin: false,
    evForbidden: false,
    foreignGuest: "all",
    nearParking: false,
    nearMainRoad: false,
    loft: "all",
    amenities: []
  };

  const searchInput = document.getElementById("heroSearchInput");
  if (searchInput) searchInput.value = "";

  if (heroDistrictSelectComponent) heroDistrictSelectComponent.setValue('all', false);
  if (heroSourceGroupSelectComponent) heroSourceGroupSelectComponent.setValue('all', false);
  if (sidebarDistrictSelectComponent) sidebarDistrictSelectComponent.setValue('all', false);
  if (sidebarSourceGroupSelectComponent) sidebarSourceGroupSelectComponent.setValue('all', false);

  const typeSelect = document.getElementById("heroTypeSelect");
  if (typeSelect) typeSelect.value = "all";

  const priceSelect = document.getElementById("heroPriceSelect");
  if (priceSelect) priceSelect.value = "all";

  const minPriceEl = document.getElementById("sidebarPriceMin");
  if (minPriceEl) minPriceEl.value = "";

  const maxPriceEl = document.getElementById("sidebarPriceMax");
  if (maxPriceEl) maxPriceEl.value = "";

  const capEl = document.getElementById("sidebarCapacity");
  if (capEl) capEl.value = "all";

  const vehEl = document.getElementById("sidebarVehicles");
  if (vehEl) vehEl.value = "all";

  const defaultRadio = document.querySelector('input[name="sidebarRoomLayout"][value="all"]');
  if (defaultRadio) defaultRadio.checked = true;

  const sidebarCheckboxes = document.querySelectorAll('#sidebarFilter input[type="checkbox"]');
  sidebarCheckboxes.forEach(cb => { cb.checked = false; });

  const typeButtons = document.querySelectorAll(".filter-type-btn");
  typeButtons.forEach((b, idx) => {
    b.classList.toggle("active", idx === 0);
  });

  const tags = document.querySelectorAll(".quick-tag-item");
  tags.forEach((t, idx) => {
    t.classList.toggle("active", idx === 0);
  });

  currentPage = 1;
  renderRooms();
  showToast("Đã làm mới tất cả bộ lọc");
}

function showToast(message) {
  let toast = document.getElementById("appToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "appToast";
    toast.className = "toast-msg";
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<i class="fas fa-check-circle" style="color: #10B981;"></i> <span>${message}</span>`;
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
  }, 4000);
}
