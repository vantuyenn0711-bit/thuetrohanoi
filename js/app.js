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

// ==========================================================================
// IMAGE OPTIMIZER - FAST WEBP CDN PROXY & RESIZING (wsrv.nl / Cloudflare)
// ==========================================================================
function getOptimizedImageUrl(url, width = 600, quality = 80) {
  if (!url || typeof url !== 'string') return DEFAULT_ROOM_IMAGE;
  const clean = url.trim();
  if (!clean || clean.startsWith('data:') || clean.startsWith('blob:')) return clean;
  if (clean.startsWith('/') || clean.startsWith('./')) return clean;
  if (clean.includes('wsrv.nl') || clean.includes('images.weserv.nl')) return clean;

  // Use wsrv.nl to resize, compress and convert to WebP on the fly (backed by Cloudflare CDN)
  return `https://wsrv.nl/?url=${encodeURIComponent(clean)}&w=${width}&q=${quality}&output=webp&we=1&default=${encodeURIComponent(DEFAULT_ROOM_IMAGE)}`;
}

let heroDistrictSelectComponent = null;
let heroSourceGroupSelectComponent = null;
let sidebarDistrictSelectComponent = null;
let sidebarSourceGroupSelectComponent = null;

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Đọc ngay từ localStorage trước để render tức thì 0ms (không bị trống phòng khi vừa mở)
  try {
    const saved = localStorage.getItem(STORAGE_ROOMS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        rooms = parsed.map(r => {
          if (r.title) r.title = transformMoithueName(r.title);
          return r;
        });
      }
    }
  } catch (e) {}

  initSearchableSelects();
  initEventListeners();
  renderRooms();
  updateWishlistCount();
  updateSidebarCounts();

  // 2. Tiếp tục đồng bộ từ API / file dữ liệu máy chủ
  await initData();
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

// Load or initialize room data
async function initData() {
  const savedWishlist = localStorage.getItem(STORAGE_WISHLIST_KEY);
  if (savedWishlist) {
    try {
      wishlist = JSON.parse(savedWishlist);
    } catch (e) {
      wishlist = [];
    }
  }

  let loaded = false;

  // 1. Thử lấy từ API / file rooms_new.json
  try {
    let res = await fetch(`/api/rooms?t=${Date.now()}`);
    if (!res.ok) {
      res = await fetch(`rooms_new.json?t=${Date.now()}`);
    }
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        rooms = data.map(r => {
          if (r.title) r.title = transformMoithueName(r.title);
          return r;
        });
        loaded = true;
        try { localStorage.setItem(STORAGE_ROOMS_KEY, JSON.stringify(rooms)); } catch(e) {}
      }
    }
  } catch (err) {
    console.warn("API fetch error, trying local storage:", err);
  }

  // 2. Nếu API không lấy được, nạp từ localStorage
  if (!loaded) {
    const savedRooms = localStorage.getItem(STORAGE_ROOMS_KEY);
    if (savedRooms) {
      try {
        const parsed = JSON.parse(savedRooms);
        if (Array.isArray(parsed) && parsed.length > 0) {
          rooms = parsed.map(r => {
            if (r.title) r.title = transformMoithueName(r.title);
            return r;
          });
          loaded = true;
        }
      } catch (e) {}
    }
  }

  // 3. Fallback sang INITIAL_ROOMS nếu vẫn chưa có
  if (!loaded && (!rooms || rooms.length === 0) && typeof INITIAL_ROOMS !== "undefined" && INITIAL_ROOMS.length > 0) {
    rooms = INITIAL_ROOMS.map(r => {
      if (r.title) r.title = transformMoithueName(r.title);
      return r;
    });
  }

  renderRooms();
  updateSidebarCounts();
  updateWishlistCount();

  // Tự động mở chi tiết phòng nếu có tham số ?room=... hoặc ?id=... trên URL
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const targetRoomId = urlParams.get('room') || urlParams.get('id');
    if (targetRoomId) {
      setTimeout(() => {
        openRoomDetailModal(targetRoomId, true);
        const cardEl = document.querySelector(`[data-room-id="${targetRoomId}"]`);
        if (cardEl) {
          cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 250);
    }
  } catch (e) {}
}

// Lắng nghe thay đổi trạng thái phòng từ trang Quản trị (Admin)
window.addEventListener('storage', (e) => {
  if (e.key === STORAGE_ROOMS_KEY && e.newValue) {
    try {
      rooms = JSON.parse(e.newValue).map(r => {
        if (r.title) r.title = transformMoithueName(r.title);
        return r;
      });
      renderRooms();
      updateSidebarCounts();
    } catch (err) {}
  }
});

// Khi chuyển tab quay lại web, tự động làm mới trạng thái phòng mới nhất
window.addEventListener('focus', () => {
  initData();
});

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
    countDisplay.innerHTML = `<span style="font-size: 1.55rem; font-weight: 800; color: #1E293B;">${totalRooms}</span> <span style="font-size: 0.95rem; font-weight: 700; color: #64748B;">kết quả</span>`;
  }

  if (totalRooms === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; background: white; border-radius: var(--radius-md); border: 1px dashed var(--border-color);">
        <i class="fas fa-search" style="font-size: 2.8rem; color: var(--text-light); margin-bottom: 16px;"></i>
        <h3 style="font-size: 1.25rem; font-weight: 700; color: var(--dark); margin-bottom: 8px;">
          Không tìm thấy phòng phù hợp
        </h3>
        <p style="color: var(--text-muted); font-size: 0.92rem; margin-bottom: 20px;">
          Vui lòng thử chọn lại khu vực khác, điều chỉnh khoảng giá hoặc bấm "Đặt lại bộ lọc" để xem danh sách phòng.
        </p>
        <div style="display: flex; justify-content: center; gap: 12px; flex-wrap: wrap;">
          <button class="btn-schedule-view" onclick="resetAllFilters()" style="background: var(--primary);">
            <i class="fas fa-redo"></i> Đặt lại tất cả lọc
          </button>
          <a href="https://zalo.me/${CONSULTANT_ZALO}" target="_blank" class="btn-schedule-view" style="background: var(--accent); text-decoration: none;">
            <i class="fas fa-comment-dots"></i> Nhắn Zalo tư vấn
          </a>
        </div>
      </div>
    `;
    if (pagiContainer) pagiContainer.innerHTML = "";
    return;
  }

  const startIndex = (currentPage - 1) * roomsPerPage;
  const displayedRooms = filtered.slice(startIndex, startIndex + roomsPerPage);

  const cardsHtml = displayedRooms.map((room, roomIdx) => {
    const isSaved = wishlist.includes(room.id);
    const priceFormatted = new Intl.NumberFormat('vi-VN').format(room.price) + " đ";
    
    // Build slider images track (Chỉ nạp trước ảnh đầu tiên dạng WebP tối ưu, các ảnh sau nạp theo yêu cầu để web siêu nhanh trên điện thoại)
    const slidesHtml = room.images.map((img, idx) => {
      const optSrc = getOptimizedImageUrl(img, 600, 80);
      const isPriority = idx === 0 && roomIdx < 4;
      return `
      <div class="card-slide-item">
        <img ${idx === 0 ? `src="${optSrc}"` : `data-src="${optSrc}"`} 
             data-fallback="${img}"
             class="card-slide-img" 
             data-index="${idx}" 
             alt="${room.title}" 
             loading="lazy" 
             decoding="async"
             ${isPriority ? 'fetchpriority="high"' : ''}
             referrerpolicy="no-referrer" 
             onerror="if(this.dataset.fallback && this.src !== this.dataset.fallback){this.src=this.dataset.fallback;}else{this.onerror=null;this.src='${DEFAULT_ROOM_IMAGE}';}">
      </div>
    `}).join("");

    const dotsHtml = room.images.map((_, idx) => `
      <div class="slider-dot ${idx === 0 ? 'active' : ''}" data-index="${idx}" onclick="jumpCardSlide('${room.id}', ${idx}, event)"></div>
    `).join("");

    // Xe điện badge nhỏ
    let evBadgeHtml = "";
    if (room.electricVehiclePolicy === 'vinfast_only' || room.electricVehicle) {
      evBadgeHtml = `<span class="card-tag-pill ev"><i class="fas fa-bolt"></i> Xe điện</span>`;
    }

    const distName = room.sourceGroupName ? room.sourceGroupName.replace("Khu vực ", "") : (DISTRICTS.find(d => d.id === room.district)?.name || 'Hà Nội');

    const isRented = room.status === 'rented';

    return `
      <div class="room-card moithue-card ${isRented ? 'is-rented' : ''}" style="--i: ${roomIdx};" data-room-id="${room.id}" onclick="openRoomDetailModal('${room.id}', true)">
        <div class="card-media-wrapper">
          <!-- Nút Yêu thích nổi tinh tế góc phải trên ảnh -->
          <button class="card-wishlist-float ${isSaved ? 'active' : ''}" title="${isSaved ? 'Đã lưu yêu thích' : 'Lưu tin này'}" onclick="toggleWishlist('${room.id}', event)">
            <i class="${isSaved ? 'fas fa-heart' : 'far fa-heart'}"></i>
          </button>

          <div class="card-image-slider" id="slider-${room.id}" data-current="0">
            <div class="card-slides-track">
              ${slidesHtml}
            </div>
            ${room.images.length > 1 ? `
              <button class="slider-btn prev" onclick="changeCardSlide('${room.id}', -1, event)" title="Ảnh trước">
                <i class="fas fa-chevron-left"></i>
              </button>
              <button class="slider-btn next" onclick="changeCardSlide('${room.id}', 1, event)" title="Ảnh tiếp theo">
                <i class="fas fa-chevron-right"></i>
              </button>
              <div class="slider-dots">${dotsHtml}</div>
            ` : ''}
          </div>
        </div>

        <div class="card-content">
          <h3 class="card-title" title="${room.title}">${room.title}</h3>

          <div class="card-bottom-row">
            <div class="price-box">
              <span class="price-value">${priceFormatted}</span>
              <span class="price-unit">/ tháng</span>
            </div>
            <div class="card-cta-group">
              <button class="btn-card-chat ${isRented ? 'rented-btn' : ''}" onclick="contactZaloRoom('${room.id}', event)" title="${isRented ? 'Nhắn Zalo tìm phòng tương tự' : 'Nhắn Zalo cố vấn'}" aria-label="Nhắn tin">
                <i class="fas ${isRented ? 'fa-history' : 'fa-comment-dots'}"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join("");

  grid.innerHTML = cardsHtml;
  renderPagination(totalRooms, currentPage, roomsPerPage);
  initTouchSliders();
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

// ==========================================================================
// CARD IMAGE SLIDER - HARDWARE ACCELERATED CAROUSEL
// ==========================================================================
function changeCardSlide(roomId, step, event) {
  if (event) event.stopPropagation();
  const slider = document.getElementById(`slider-${roomId}`);
  if (!slider) return;

  const track = slider.querySelector(".card-slides-track");
  const items = slider.querySelectorAll(".card-slide-item");
  const dots = slider.querySelectorAll(".slider-dot");
  if (!track || items.length <= 1) return;

  let currentIndex = parseInt(slider.dataset.current || "0", 10);
  let nextIndex = currentIndex + step;
  if (nextIndex < 0) nextIndex = items.length - 1;
  if (nextIndex >= items.length) nextIndex = 0;

  slider.dataset.current = nextIndex;

  // Lazy load ảnh đích và ảnh kế tiếp
  const targetImg = items[nextIndex].querySelector(".card-slide-img");
  if (targetImg && targetImg.dataset.src && (!targetImg.src || targetImg.src.endsWith('/undefined') || targetImg.src === window.location.href)) {
    targetImg.src = targetImg.dataset.src;
  }
  const nextNextImg = items[(nextIndex + 1) % items.length].querySelector(".card-slide-img");
  if (nextNextImg && nextNextImg.dataset.src && (!nextNextImg.src || nextNextImg.src.endsWith('/undefined') || nextNextImg.src === window.location.href)) {
    nextNextImg.src = nextNextImg.dataset.src;
  }

  // Smooth slide transition
  track.style.transform = `translateX(-${nextIndex * 100}%)`;

  dots.forEach((dot, idx) => {
    dot.classList.toggle("active", idx === nextIndex);
  });
}

function jumpCardSlide(roomId, targetIndex, event) {
  if (event) event.stopPropagation();
  const slider = document.getElementById(`slider-${roomId}`);
  if (!slider) return;

  const track = slider.querySelector(".card-slides-track");
  const items = slider.querySelectorAll(".card-slide-item");
  const dots = slider.querySelectorAll(".slider-dot");
  if (!track || items.length <= 1) return;

  slider.dataset.current = targetIndex;

  const targetImg = items[targetIndex].querySelector(".card-slide-img");
  if (targetImg && targetImg.dataset.src && (!targetImg.src || targetImg.src.endsWith('/undefined') || targetImg.src === window.location.href)) {
    targetImg.src = targetImg.dataset.src;
  }

  track.style.transform = `translateX(-${targetIndex * 100}%)`;

  dots.forEach((dot, idx) => {
    dot.classList.toggle("active", idx === targetIndex);
  });
}

// Touch swipe gestures for card image slider (Smooth Swipe)
function initTouchSliders() {
  document.querySelectorAll('.card-image-slider').forEach(slider => {
    let startX = 0;
    let startY = 0;
    let isSwiping = false;

    slider.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        isSwiping = false;
      }
    }, { passive: true });

    slider.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1) {
        const diffX = e.touches[0].clientX - startX;
        const diffY = e.touches[0].clientY - startY;
        if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 8) {
          isSwiping = true;
        }
      }
    }, { passive: true });

    slider.addEventListener('touchend', (e) => {
      if (!isSwiping) return;
      const endX = e.changedTouches[0].clientX;
      const diffX = endX - startX;
      const roomId = slider.id.replace('slider-', '');
      if (diffX < -25) {
        // Vuốt sang trái -> Xem ảnh tiếp theo
        changeCardSlide(roomId, 1, e);
      } else if (diffX > 25) {
        // Vuốt sang phải -> Xem ảnh trước đó
        changeCardSlide(roomId, -1, e);
      }
    }, { passive: true });
  });
}

function initModalTouchGallery() {
  const mainGallery = document.querySelector('.detail-gallery-main');
  if (!mainGallery) return;
  let startX = 0;
  let isSwiping = false;

  mainGallery.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      startX = e.touches[0].clientX;
      isSwiping = false;
    }
  }, { passive: true });

  mainGallery.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1) {
      const diffX = e.touches[0].clientX - startX;
      if (Math.abs(diffX) > 10) isSwiping = true;
    }
  }, { passive: true });

  mainGallery.addEventListener('touchend', (e) => {
    if (!isSwiping || !currentDetailRoom || !currentDetailRoom.images || currentDetailRoom.images.length <= 1) return;
    const diffX = e.changedTouches[0].clientX - startX;
    if (Math.abs(diffX) > 35) {
      const thumbs = document.querySelectorAll('.thumb-img');
      let curIdx = Array.from(thumbs).findIndex(t => t.classList.contains('active'));
      if (curIdx === -1) curIdx = 0;
      let nextIdx = diffX < 0 ? curIdx + 1 : curIdx - 1;
      if (nextIdx >= currentDetailRoom.images.length) nextIdx = 0;
      if (nextIdx < 0) nextIdx = currentDetailRoom.images.length - 1;
      const nextThumb = thumbs[nextIdx];
      const nextImgLarge = nextThumb ? (nextThumb.dataset.large || getOptimizedImageUrl(currentDetailRoom.images[nextIdx], 1200, 85)) : getOptimizedImageUrl(currentDetailRoom.images[nextIdx], 1200, 85);
      switchDetailImg(nextImgLarge, nextThumb);
      if (nextThumb) nextThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, { passive: true });
}

// Filter logic (Toàn bộ tiêu chí lọc chuẩn xác theo giao diện Listivo / Mời Thuê)
function getFilteredRooms() {
  return rooms.filter(room => {
    // 0. Ẩn hoàn toàn các phòng đã hết / đã cho thuê đối với khách xem
    if (room.status === "rented" || room.statusName === "Đã cho thuê" || room.status === "het-phong") {
      return false;
    }

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

    // 8. Dạng phòng & Loại nhà (Phân cấp cây: Khép kín -> Studio/1N1K/2N1K/3N1K, Nguyên căn)
    if (currentFilter.roomLayout !== "all") {
      const layout = currentFilter.roomLayout.toLowerCase();
      const rLayout = (room.roomLayout || "").toLowerCase();
      const rCategory = (room.categoryName || "").toLowerCase();
      const rTag = (room.tag || "").toLowerCase();
      const rTitle = (room.title || "").toLowerCase();

      const isNguyenCan = rCategory.includes("nguyên căn") || rLayout.includes("nguyên căn") || rTag.includes("nguyên căn");
      const isKhepKin = !isNguyenCan;

      if (layout === "khep-kin-all") {
        if (!isKhepKin) return false;
      } else if (layout === "nguyen-can") {
        if (!isNguyenCan) return false;
      } else if (layout === "studio") {
        if (!isKhepKin) return false;
        const isMulti = rLayout.includes('1n1k') || rTitle.includes('1n1k') || rTag.includes('1n1k') ||
                        rLayout.includes('2n1k') || rTitle.includes('2n1k') || rTag.includes('2n1k') ||
                        rLayout.includes('3n1k') || rTitle.includes('3n1k') || rTag.includes('3n1k');
        if (isMulti) return false;
      } else {
        // Nhánh con của Khép kín: 1n1k, 2n1k, 3n1k
        if (!isKhepKin) return false;
        if (!rLayout.includes(layout) && !rTitle.includes(layout) && !rTag.includes(layout) && !rCategory.includes(layout)) {
          return false;
        }
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
                      (room.roomLayout === "Gác xép") ||
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
        ${savedRooms.map(room => {
          const thumbOpt = getOptimizedImageUrl(room.images[0], 160, 75);
          return `
          <div style="display: flex; gap: 16px; align-items: center; background: var(--bg-alt); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
            <img src="${thumbOpt}" 
                 data-fallback="${room.images[0]}" 
                 loading="lazy" 
                 decoding="async"
                 referrerpolicy="no-referrer" 
                 onerror="if(this.dataset.fallback && this.src !== this.dataset.fallback){this.src=this.dataset.fallback;}else{this.onerror=null;this.src='${DEFAULT_ROOM_IMAGE}';}" 
                 style="width: 80px; height: 70px; object-fit: cover; border-radius: var(--radius-sm); cursor: pointer;" 
                 alt="${room.title}" 
                 onclick="closeModal('wishlistModal'); openRoomDetailModal('${room.id}', true);">
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
        `}).join("")}
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
    .replace(/&nbsp;|\u00A0/g, ' ')
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8230;/g, '...')
    .replace(/&#038;/g, '&')
    .replace(/&amp;/g, '&')
    .replace(/&hellip;/g, '...')
    .replace(/\[\.\.\.\]/g, '')
    .trim();

  // Tự động chèn ngắt dòng nếu các trường bị dính liền nhau
  clean = clean.replace(/([^\n])\s*(?=(?:ĐỊA CHỈ|Ngõ|Tình trạng|Trống|Diện tích|Thang máy|Dạng phòng|Nội thất|Gần trường|Gần chợ|Gần bãi|Điện|Nước|Internet|Mạng|Dịch vụ chung|Thêm đồ|Bớt đồ|Xe máy|Tối đa|Nuôi pet|Xe điện|Khách tây|Giờ giấc|Chung chủ|Phơi đồ|Máy giặt|Tổng số tầng|Hợp đồng|Thanh toán|Ngày lùi)\s*[:•])/gi, '$1\n');
  clean = clean.replace(/([^\n])\s*(?=(?:✅|🚚|🏆|❎))/gu, '$1\n\n');
  clean = clean.replace(/([^\n])\s*•\s*/g, '$1\n• ');

  // Tách dòng
  let lines = clean.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  return lines.map(line => {
    // 1. Tiêu đề khối lớn như ✅ TIỆN ÍCH, 🚚 DỊCH VỤ, ❎ LƯU Ý
    if (/^(?:✅\s*TIỆN ÍCH|TIỆN ÍCH\b|(?:🚚|🏆)\s*DỊCH VỤ|DỊCH VỤ\b|❎\s*LƯU Ý|LƯU Ý\b)/i.test(line)) {
      return `<div style="margin-top: 14px; margin-bottom: 6px; font-weight: 800; font-size: 1rem; color: #0F172A; display: flex; align-items: center; gap: 6px;">${line}</div>`;
    }
    // 2. Dấu bullet •
    if (/^[•—\-*]/.test(line)) {
      return `<div style="display: flex; gap: 8px; margin-bottom: 4px; align-items: baseline; padding-left: 2px;"><span style="color: #64748B; font-weight: 800;">•</span><span style="color: #334155;">${line.replace(/^[•—\-*]\s*/, '')}</span></div>`;
    }
    // 3. Các dòng thụt lề con của Gần trường (vd: Kinh Kỹ ~1,5km)
    if (/^(?:Kinh Kỹ|Kinh Công|Bách Kinh Xây|Đại Học|ĐH|Học Viện|HV|CĐ|Cao Đẳng)\b/i.test(line)) {
      return `<div style="padding-left: 18px; margin-bottom: 4px; color: #475569; font-size: 0.92rem;">${line}</div>`;
    }
    // 4. Các icon thuộc tính (🍡, 🛋️, ⏳, 📋...)
    if (/^(?:🍡|🛋️|⏳|📋)/u.test(line)) {
      return `<div style="margin-bottom: 5px; font-weight: 500; color: #1E293B;">${line}</div>`;
    }
    // 5. Tiêu đề THÔNG TIN PHÒNG_LN
    if (/^THÔNG TIN PHÒNG/i.test(line)) {
      return `<div style="font-weight: 700; color: #64748B; margin-bottom: 12px; font-size: 0.95rem;">${line}</div>`;
    }
    return `<div style="margin-bottom: 5px; color: #334155;">${line}</div>`;
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

  // Available floors
  let floors = room.availableFloors || [];
  if (floors.length === 0) {
    const titleRoomMatch = room.title ? room.title.match(/(?:_|\s)(\d{3}(?:\s*,\s*\d{3})+)/) : null;
    if (titleRoomMatch) {
      floors = titleRoomMatch[1].split(',').map(n => 'P.' + n.trim());
    } else {
      const floorTags = (room.description || '').match(/(?:P\.?\s*\d+|Tầng\s*\d+)/gi);
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
    const ytInDesc = (room.description || '').match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
    if (ytInDesc) ytUrl = `https://www.youtube.com/watch?v=${ytInDesc[1]}`;
  }
  const driveUrl = room.videoDriveUrl || '';

  content.innerHTML = `
    <!-- Gallery -->
    <div class="detail-gallery">
      <div class="detail-gallery-main" style="position: relative;">
        <img src="${getOptimizedImageUrl(room.images[0], 1200, 85)}" 
             data-fallback="${room.images[0]}" 
             id="detailMainImg" 
             alt="${room.title}" 
             decoding="async"
             referrerpolicy="no-referrer" 
             onerror="if(this.dataset.fallback && this.src !== this.dataset.fallback){this.src=this.dataset.fallback;}else{this.onerror=null;this.src='${DEFAULT_ROOM_IMAGE}';}">
        <div class="gallery-photo-count" style="position: absolute; bottom: 12px; right: 12px; background: rgba(0,0,0,0.75); color: white; padding: 6px 14px; border-radius: 20px; font-weight: 700; font-size: 0.85rem; backdrop-filter: blur(4px);">
          <i class="fas fa-images"></i> ${room.images.length} ảnh phòng thực tế
        </div>
      </div>
      <div class="detail-gallery-thumbs" style="display: flex; gap: 8px; overflow-x: auto; padding: 6px 0;">
        ${room.images.map((img, idx) => {
          const thumbSrc = getOptimizedImageUrl(img, 180, 75);
          const largeSrc = getOptimizedImageUrl(img, 1200, 85);
          return `
          <img src="${thumbSrc}" 
               data-large="${largeSrc}"
               data-fallback="${img}"
               class="thumb-img ${idx === 0 ? 'active' : ''}" 
               onclick="switchDetailImg('${largeSrc}', this)" 
               alt="Ảnh phòng ${idx + 1}" 
               loading="lazy" 
               decoding="async"
               referrerpolicy="no-referrer" 
               onerror="if(this.dataset.fallback && this.src !== this.dataset.fallback){this.src=this.dataset.fallback;}else{this.onerror=null;this.src='${DEFAULT_ROOM_IMAGE}';}" 
               style="width: 80px; height: 60px; object-fit: cover; border-radius: 6px; cursor: pointer; border: 2px solid ${idx === 0 ? 'var(--primary)' : 'transparent'}; flex-shrink: 0;">
        `}).join("")}
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

    ${room.status === 'rented' ? `
    <!-- === BANNER CẢNH BÁO PHÒNG ĐÃ CHO THUÊ === -->
    <div style="background: #FEF2F2; border: 2px solid #EF4444; border-radius: 12px; padding: 14px 18px; margin-bottom: 18px; color: #991B1B; display: flex; align-items: center; gap: 14px; box-shadow: 0 4px 14px rgba(239, 68, 68, 0.12);">
      <div style="width: 42px; height: 42px; min-width: 42px; border-radius: 50%; background: #DC2626; color: white; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">
        <i class="fas fa-lock"></i>
      </div>
      <div>
        <div style="font-size: 1.05rem; font-weight: 800; color: #B91C1C;">🔴 PHÒNG NÀY ĐÃ ĐƯỢC CHO THUÊ (HẾT PHÒNG)</div>
        <div style="font-size: 0.88rem; font-weight: 500; color: #7F1D1D; margin-top: 2px;">Căn phòng này hiện đã có khách chốt thuê. Quý khách vui lòng bấm nút Nhắn Zalo <strong>0358.954.360</strong> để được gửi ngay danh sách các phòng tương tự đang còn trống!</div>
      </div>
    </div>
    ` : ''}

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

    <!-- === MÔ TẢ (1 PHẦN ĐẦY ĐỦ 100% CHUẨN MOITHUE) === -->
    <div class="detail-description-section" style="margin-bottom: 26px;">
      <h3 style="font-size: 1.35rem; font-weight: 800; color: #0F172A; margin-bottom: 14px; letter-spacing: -0.3px;">
        Mô tả
      </h3>
      <div style="background: #FAFAFA; border: 1px solid #E2E8F0; border-radius: 12px; padding: 22px 24px; font-size: 0.95rem; line-height: 1.85; color: #334155;">
        ${formatDescContent(room.description || `${room.title} tại ${room.address}.`)}
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
        <i class="fas fa-phone-alt" style="color: var(--primary);"></i> Gọi: 0358.954.360
      </a>
      <button class="btn-schedule-view" style="padding: 12px 26px; font-size: 0.98rem; font-weight: 800; border-radius: 8px; border: none; cursor: pointer; color: white; background: linear-gradient(135deg, #0068FF, #0052cc); box-shadow: 0 4px 14px rgba(0, 104, 255, 0.35); display: inline-flex; align-items: center; gap: 8px;" onclick="contactZaloRoom('${room.id}')">
        <i class="fas fa-comment-dots"></i> Nhắn Zalo lên lịch hẹn
      </button>
    </div>
  `;

  openModal("roomDetailModal");
  initModalTouchGallery();
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
function getAvailableRooms() {
  if (!rooms) return [];
  return rooms.filter(r => r.status !== 'rented' && r.statusName !== 'Đã cho thuê' && r.status !== 'het-phong');
}

function getDistrictCount(districtId) {
  const activeRooms = getAvailableRooms();
  if (activeRooms.length === 0) return 0;
  if (districtId === 'all') return activeRooms.length;
  const target = districtId.replace(/^(quan-|huyen-)/, '').toLowerCase();
  return activeRooms.filter(r => {
    const rd = (r.district || '').replace(/^(quan-|huyen-)/, '').toLowerCase();
    return rd === target;
  }).length;
}

function getSourceGroupCount(sourceGroupId) {
  const activeRooms = getAvailableRooms();
  if (activeRooms.length === 0) return 0;
  if (sourceGroupId === 'all') return activeRooms.length;
  return activeRooms.filter(r => (r.sourceGroup || '') === sourceGroupId).length;
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
  const activeRooms = getAvailableRooms();
  const allCount = activeRooms.length;

  const isNguyenCan = (r) => {
    const c = (r.categoryName || "").toLowerCase();
    const l = (r.roomLayout || "").toLowerCase();
    const t = (r.tag || "").toLowerCase();
    return c.includes("nguyên căn") || l.includes("nguyên căn") || t.includes("nguyên căn");
  };

  const isKhepKin = (r) => !isNguyenCan(r);

  const khepKinCount = activeRooms.filter(isKhepKin).length;
  const studioCount = activeRooms.filter(r => {
    if (!isKhepKin(r)) return false;
    const l = (r.roomLayout || "").toLowerCase();
    const t = (r.title || "").toLowerCase();
    const tag = (r.tag || "").toLowerCase();
    const isMulti = l.includes('1n1k') || t.includes('1n1k') || tag.includes('1n1k') ||
                    l.includes('2n1k') || t.includes('2n1k') || tag.includes('2n1k') ||
                    l.includes('3n1k') || t.includes('3n1k') || tag.includes('3n1k');
    return !isMulti;
  }).length;

  const n1kCount = activeRooms.filter(r => isKhepKin(r) && ((r.roomLayout || "").toLowerCase().includes("1n1k") || (r.title || "").toLowerCase().includes("1n1k") || (r.tag || "").toLowerCase().includes("1n1k"))).length;
  const n2kCount = activeRooms.filter(r => isKhepKin(r) && ((r.roomLayout || "").toLowerCase().includes("2n1k") || (r.title || "").toLowerCase().includes("2n1k") || (r.tag || "").toLowerCase().includes("2n1k"))).length;
  const n3kCount = activeRooms.filter(r => isKhepKin(r) && ((r.roomLayout || "").toLowerCase().includes("3n1k") || (r.title || "").toLowerCase().includes("3n1k") || (r.tag || "").toLowerCase().includes("3n1k"))).length;
  const nguyenCanCount = activeRooms.filter(isNguyenCan).length;

  const setBadge = (id, count) => {
    const el = document.getElementById(id);
    if (el) el.innerText = `(${count})`;
  };

  setBadge("countLayoutAll", allCount);
  setBadge("countLayoutKhepKin", khepKinCount);
  setBadge("countLayoutStudio", studioCount);
  setBadge("countLayout1N1K", n1kCount);
  setBadge("countLayout2N1K", n2kCount);
  setBadge("countLayout3N1K", n3kCount);
  setBadge("countLayoutNguyenCan", nguyenCanCount);

  // Update dynamic counts in all SearchableSelect dropdowns
  const distItems = getDistrictItems();
  const srcItems = getSourceGroupItems();
  if (heroDistrictSelectComponent) heroDistrictSelectComponent.setItems(distItems);
  if (heroSourceGroupSelectComponent) heroSourceGroupSelectComponent.setItems(srcItems);
  if (sidebarDistrictSelectComponent) sidebarDistrictSelectComponent.setItems(distItems);
  if (sidebarSourceGroupSelectComponent) sidebarSourceGroupSelectComponent.setItems(srcItems);
}

function setQuickChip(chipId, btnEl) {
  document.querySelectorAll(".filter-quick-chip").forEach(b => b.classList.remove("active"));
  if (btnEl) btnEl.classList.add("active");

  if (chipId === "all") {
    currentFilter.loft = "all";
    currentFilter.evAllowed = false;
    currentFilter.evVin = false;
    currentFilter.pet = "all";
    currentFilter.elevator = "all";
  } else if (chipId === "gac-xep") {
    currentFilter.loft = "has_loft";
  } else if (chipId === "xe-dien") {
    currentFilter.evAllowed = true;
  } else if (chipId === "nuoi-pet") {
    currentFilter.pet = "allowed";
  } else if (chipId === "thang-may") {
    currentFilter.elevator = "elevator";
  }

  currentPage = 1;
  renderRooms();
  const el = document.getElementById("listingsSection");
  if (el) el.scrollIntoView({ behavior: "smooth" });
}

function toggleSidebarFilter() {
  const sidebar = document.getElementById("sidebarFilter");
  const backdrop = document.getElementById("sidebarBackdrop");
  if (sidebar) {
    const isActive = sidebar.classList.toggle("active");
    if (backdrop) backdrop.classList.toggle("active", isActive);
    
    if (isActive) {
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
      document.body.style.touchAction = "none";
    } else {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
    }
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

  const radioLayoutAll = document.querySelector('input[name="sidebarRoomLayout"][value="all"]');
  if (radioLayoutAll) radioLayoutAll.checked = true;

  const quickChips = document.querySelectorAll(".filter-quick-chip");
  quickChips.forEach(b => b.classList.toggle("active", b.getAttribute("data-chip") === "all"));

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
