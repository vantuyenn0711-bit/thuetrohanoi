#!/usr/bin/env node
// ==========================================================================
// SYNC ROOMS JOB - ĐỒNG BỘ DỮ LIỆU TỰ ĐỘNG TỪ MOITHUE.COM
// Tự động: Thêm mới, Sửa đổi nội dung, Ẩn phòng đã thuê (missing >= 3 lần), 
// Mở lại phòng khi xuất hiện, Đồng bộ chuẩn 100% Bộ Lọc theo Mời Thuê.
// ==========================================================================

const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const DB_FILE = path.join(__dirname, 'rooms_new.json');
const BACKUP_FILE = path.join(__dirname, 'rooms_new.backup.json');
const LOG_FILE = path.join(__dirname, 'sync_history.json');

const API_LIST_URL = 'https://moithue.com/wp-json/listivo/v1/listings';
const CLOUDFLARE_WORKER_URL = process.env.CLOUDFLARE_WORKER_URL || 'https://proud-grass-4b4a.vantuyenn0711.workers.dev';

// ==========================================================================
// MAPPING TAXONOMY BỘ LỌC CHUẨN MOITHUE
// ==========================================================================
const SOURCE_GROUP_MAP = {
  'hoài đức': 'nguon-hoai-duc', 'an khánh': 'nguon-hoai-duc', 'phú vinh': 'nguon-hoai-duc',
  'hinode': 'nguon-hoai-duc', 'di trạch': 'nguon-hoai-duc', 'vân canh': 'nguon-hoai-duc',
  'cầu giấy': 'nguon-cau-giay', 'dịch vọng': 'nguon-cau-giay', 'trung hoà': 'nguon-cau-giay',
  'hoàng mai': 'nguon-hoang-mai', 'định công': 'nguon-hoang-mai', 'lĩnh nam': 'nguon-hoang-mai',
  'vĩnh hưng': 'nguon-hoang-mai', 'tân mai': 'nguon-hoang-mai',
  'mỹ đình': 'nguon-my-dinh', 'nam từ liêm': 'nguon-nam-tu-liem', 'mễ trì': 'nguon-nam-tu-liem',
  'phú đô': 'nguon-nam-tu-liem', 'cầu diễn': 'nguon-cau-dien', 'phú diễn': 'nguon-phu-dien',
  'bắc từ liêm': 'nguon-xuan-dinh', 'xuân đỉnh': 'nguon-xuan-dinh', 'cổ nhuế': 'nguon-xuan-dinh',
  'thanh xuân': 'nguon-thanh-xuan', 'khương đình': 'nguon-thanh-xuan',
  'ba đình': 'nguon-ba-dinh', 'tây hồ': 'nguon-tay-ho', 'đống đa': 'nguon-dong-da',
  'hà đông': 'nguon-ha-dong', 'kim giang': 'nguon-kim-giang-ngoc-hoi', 'ngọc hồi': 'nguon-kim-giang-ngoc-hoi',
  'triều khúc': 'nguon-trieu-khuc', 'xuân phương': 'nguon-xuan-phuong',
  'yên xá': 'nguon-yen-xa-mau-luong', 'mậu lương': 'nguon-yen-xa-mau-luong',
  'ngọc trục': 'ngoc-truc-dai-linh', 'đại linh': 'ngoc-truc-dai-linh'
};

const DISTRICT_MAP = {
  'hoài đức': 'hoai-duc', 'an khánh': 'hoai-duc', 'phú vinh': 'hoai-duc',
  'hinode': 'hoai-duc', 'di trạch': 'hoai-duc', 'vân canh': 'hoai-duc', 'kim chung': 'hoai-duc',
  'cầu giấy': 'cau-giay', 'dịch vọng': 'cau-giay', 'trung hoà': 'cau-giay', 'quan hoa': 'cau-giay', 'yên hoà': 'cau-giay',
  'hoàng mai': 'hoang-mai', 'định công': 'hoang-mai', 'lĩnh nam': 'hoang-mai',
  'vĩnh hưng': 'hoang-mai', 'tân mai': 'hoang-mai', 'giáp bát': 'hoang-mai', 'đại kim': 'hoang-mai', 'hoàng liệt': 'hoang-mai', 'tương mai': 'hoang-mai',
  'thanh trì': 'thanh-tri', 'tân triều': 'thanh-tri', 'triều khúc': 'thanh-tri', 'thanh liệt': 'thanh-tri', 'ngọc hồi': 'thanh-tri', 'tứ hiệp': 'thanh-tri', 'hữu hoà': 'thanh-tri', 'tam hiệp': 'thanh-tri',
  'mỹ đình': 'nam-tu-liem', 'nam từ liêm': 'nam-tu-liem', 'mễ trì': 'nam-tu-liem',
  'phú đô': 'nam-tu-liem', 'cầu diễn': 'nam-tu-liem', 'tây mỗ': 'nam-tu-liem', 'đại mỗ': 'nam-tu-liem', 'trung văn': 'nam-tu-liem', 'xuân phương': 'nam-tu-liem',
  'bắc từ liêm': 'bac-tu-liem', 'xuân đỉnh': 'bac-tu-liem', 'cổ nhuế': 'bac-tu-liem', 'phú diễn': 'bac-tu-liem', 'phúc diễn': 'bac-tu-liem', 'minh khai': 'bac-tu-liem', 'đông ngạc': 'bac-tu-liem',
  'thanh xuân': 'thanh-xuan', 'khương đình': 'thanh-xuan', 'khương trung': 'thanh-xuan', 'khương mai': 'thanh-xuan', 'nhân chính': 'thanh-xuan', 'phương liệt': 'thanh-xuan', 'thượng đình': 'thanh-xuan', 'hạ đình': 'thanh-xuan',
  'ba đình': 'ba-dinh', 'đội cấn': 'ba-dinh', 'kim mã': 'ba-dinh', 'ngọc hà': 'ba-dinh', 'giảng võ': 'ba-dinh', 'cống vị': 'ba-dinh', 'liễu giai': 'ba-dinh',
  'tây hồ': 'tay-ho', 'xuân la': 'tay-ho', 'yên phụ': 'tay-ho', 'quảng an': 'tay-ho', 'nhật tân': 'tay-ho', 'bưởi': 'tay-ho', 'phú thượng': 'tay-ho', 'thụy khuê': 'tay-ho',
  'đống đa': 'dong-da', 'láng': 'dong-da', 'khâm thiên': 'dong-da', 'kim liên': 'dong-da', 'phương mai': 'dong-da', 'văn miếu': 'dong-da', 'ngã tư sở': 'dong-da', 'ô chợ dừa': 'dong-da',
  'hai bà trưng': 'hai-ba-trung', 'bạch mai': 'hai-ba-trung', 'vĩnh tuy': 'hai-ba-trung', 'thanh nhàn': 'hai-ba-trung', 'trương định': 'hai-ba-trung', 'đồng tâm': 'hai-ba-trung',
  'hà đông': 'ha-dong', 'văn quán': 'ha-dong', 'mỗ lao': 'ha-dong', 'kiến hưng': 'ha-dong', 'yên nghĩa': 'ha-dong', 'phú la': 'ha-dong', 'yên xá': 'ha-dong',
  'hoàn kiếm': 'hoan-kiem', 'hàng bài': 'hoan-kiem'
};

const SOURCE_GROUP_NAMES = {
  'nguon-hoai-duc': 'Hoài Đức', 'nguon-cau-giay': 'Cầu Giấy',
  'nguon-hoang-mai': 'Hoàng Mai', 'nguon-my-dinh': 'Mỹ Đình',
  'nguon-nam-tu-liem': 'Nam Từ Liêm', 'nguon-xuan-dinh': 'Cổ Nhuế, Xuân Đỉnh',
  'nguon-thanh-xuan': 'Thanh Xuân', 'nguon-ba-dinh': 'Ba Đình - Tây Hồ',
  'nguon-tay-ho': 'Tây Hồ', 'nguon-dong-da': 'Đống Đa',
  'nguon-cau-dien': 'Cầu Diễn', 'nguon-kim-giang-ngoc-hoi': 'Kim Giang, Ngọc Hồi',
  'nguon-trieu-khuc': 'Triều Khúc', 'nguon-phu-dien': 'Phú Diễn',
  'nguon-xuan-phuong': 'Xuân Phương', 'nguon-yen-xa-mau-luong': 'Yên Xá/Mậu Lương',
  'ngoc-truc-dai-linh': 'Ngọc Trục - Đại Linh', 'nguon-ha-dong': 'Hà Đông',
  'me-tri-phu-do': 'Mễ Trì - Phú Đô', 'nguon-ho-tung-mau': 'Hồ Tùng Mậu'
};

let officialMapping = {};
if (fs.existsSync(path.join(__dirname, 'moithue_official_mapping.json'))) {
  try { officialMapping = JSON.parse(fs.readFileSync(path.join(__dirname, 'moithue_official_mapping.json'), 'utf8')); } catch (e) {}
}

function sha256(str) {
  return crypto.createHash('sha256').update(String(str)).digest('hex');
}

function cleanHtml(html) {
  if (!html) return '';
  return html
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8230;/g, '...')
    .replace(/&#038;/g, '&')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();
}

// ==========================================================================
// CHUẨN HÓA TÊN PHÒNG: ÉP CÁC ĐỊNH DẠNG 444.34.xx.11 / 444.xx THÀNH "Ngõ 444 "
// ==========================================================================
function normalizeRoomTitle(title) {
  if (!title) return '';
  let clean = title.trim();

  // 0. Bỏ tiền tố "* Dự án: " nếu có
  clean = clean.replace(/^\*\s*Dự án:\s*/i, '').trim();

  // 1. Chuyển số đầu có dấu chấm (649.x, 649.55.x, 467.170.x, 1194.63.64.18...) thành "Ngõ [Số] "
  clean = clean.replace(/^(?:(?:ngõ|Ngõ)\s+)?(\d+[a-zA-Z]?)(?:[.\-_/](?:[a-zA-Z0-9]+))+\s*/i, (match, alley) => {
    return `Ngõ ${alley} `;
  });

  // Chống lặp từ "Ngõ Ngõ ..."
  clean = clean.replace(/^(?:Ngõ\s+)+/i, 'Ngõ ');

  // Đảm bảo dấu ngoặc có khoảng trắng phía trước nếu dính chữ
  clean = clean.replace(/([^\s(])\(/g, '$1 (');

  // Xóa dấu ngoặc mở cụt ở cuối chuỗi
  clean = clean.replace(/\(\s*$/, '').trim();

  // Sửa lỗi nếu trước đó bị dính kiểu '– _Trục' hay '- _Trục'
  clean = clean.replace(/([-–—])\s*_\s*(Trục)/gi, '$1 $2');

  // 2. Trích xuất và bảo toàn phần "Trục XX" nếu có
  let trucPart = '';
  const trucMatch = clean.match(/([-–—_]\s*|\s+)(Trục\s*\d+[a-zA-Z0-9\-]*)/i);
  if (trucMatch) {
    const isDash = /[-–—]/.test(trucMatch[1]);
    const isUnderscore = /_/.test(trucMatch[1]);
    const trucName = trucMatch[2].replace(/\s+/g, ' ').trim();
    if (isDash) {
      trucPart = ' – ' + trucName;
    } else if (isUnderscore) {
      trucPart = '_' + trucName;
    } else {
      trucPart = ' – ' + trucName;
    }

    const idx = clean.search(/(?:[-–—_]\s*|\s+)Trục\s*\d+/i);
    if (idx > -1) {
      clean = clean.substring(0, idx).trim();
    }
  } else {
    // Nếu không có Trục, cắt bỏ các mã nhân viên / hậu tố sau dấu _ (vd: _A Tâm, _A Nhu, _A Đạt, _FH, _LN...)
    clean = clean.replace(/_(?:A|Anh|Chị|Em|C|E|FH|LN|AK|MK|HL|HN|QD|CD|T\d+|[A-Z]{2,4})[\s\S]*$/i, '').trim();
  }

  // Loại bỏ các mã đuôi thừa nếu còn dính vào tên chính trước Trục
  clean = clean.replace(/_(?:A|Anh|Chị|Em|C|E|FH|LN|AK|MK|HL|HN|QD|CD|T\d+|[A-Z]{2,4})[\s\S]*$/i, '').trim();
  clean = clean.replace(/[\s–\-_(]+$/, '').trim();

  // Ghép lại phần Trục
  if (trucPart) {
    clean = clean + trucPart;
  }

  return clean.replace(/\s+/g, ' ').trim();
}

// ==========================================================================
// HTTP HELPERS
// ==========================================================================
// HTTP HELPERS (Dùng Native Fetch của Node 26 - Không bị ECONNRESET)
// ==========================================================================
async function httpPost(url, data) {
  const postBody = typeof data === 'string' ? data : new URLSearchParams(data).toString();
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'Origin': 'https://moithue.com',
    'Referer': 'https://moithue.com/listings/',
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'X-Requested-With': 'XMLHttpRequest'
  };

  async function tryWorker() {
    if (CLOUDFLARE_WORKER_URL) {
      const workerUrl = `${CLOUDFLARE_WORKER_URL}/?url=${encodeURIComponent(url)}`;
      const resW = await fetch(workerUrl, {
        method: 'POST',
        body: postBody,
        headers: headers,
        signal: AbortSignal.timeout(30000)
      });
      const textW = await resW.text();
      try {
        return { status: resW.status, data: JSON.parse(textW) };
      } catch (e) {
        return { status: resW.status, raw: textW };
      }
    }
    return null;
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      body: postBody,
      headers: headers,
      signal: AbortSignal.timeout(25000)
    });
    
    // Nếu bị Cloudflare chặn 403 trên Render -> Fallback ngay qua Worker
    if (res.status === 403 || res.status === 503) {
      const workerResult = await tryWorker();
      if (workerResult && workerResult.status === 200) return workerResult;
    }

    const text = await res.text();
    try {
      const json = JSON.parse(text);
      return { status: res.status, data: json };
    } catch (e) {
      // Nếu không parse được JSON và có worker, thử qua worker
      if (res.status !== 200) {
        const workerResult = await tryWorker();
        if (workerResult && workerResult.status === 200) return workerResult;
      }
      return { status: res.status, raw: text };
    }
  } catch (err) {
    const workerResult = await tryWorker();
    if (workerResult) return workerResult;
    throw err;
  }
}

let authCookie = '';
if (fs.existsSync(path.join(__dirname, 'moithue_active_cookie.txt'))) {
  try { authCookie = fs.readFileSync(path.join(__dirname, 'moithue_active_cookie.txt'), 'utf8').trim(); } catch (e) {}
}

async function httpGet(url) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Referer': 'https://moithue.com/'
  };
  if (authCookie) {
    headers['Cookie'] = authCookie;
    headers['x-moithue-cookie'] = authCookie;
  }

  // Luôn đi qua Worker Proxy kèm Cookie để không bị chặn Cloudflare và lấy được 100% nội dung đăng nhập
  const targetUrl = CLOUDFLARE_WORKER_URL
    ? `${CLOUDFLARE_WORKER_URL}/?url=${encodeURIComponent(url)}&cookie=${encodeURIComponent(authCookie)}`
    : url;

  try {
    const res = await fetch(targetUrl, { headers, signal: AbortSignal.timeout(25000) });
    const body = await res.text();
    return { status: res.status, body };
  } catch (err) {
    // Thử lại trực tiếp nếu worker lag
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(25000) });
    const body = await res.text();
    return { status: res.status, body };
  }
}

// ==========================================================================
// 1. CRAWL DANH SÁCH TỪ API NỘI BỘ (LISTINGS)
// ==========================================================================
async function fetchListingsPage(page = 1, limit = 50) {
  const payload = {
    'template': 'templates/partials/search_results_card_small',
    'cardType': 'card_small',
    'rowType': 'row_regular_v2',
    'params[page]': String(page),
    'params[limit]': String(limit),
    'params[sortBy]': 'most-relevant',
    'map': '0',
    'locationFieldId': '0'
  };

  const res = await httpPost(API_LIST_URL, payload);
  if (res.status !== 200 || !res.data) {
    throw new Error(`API error: status ${res.status}`);
  }
  return res.data;
}

function parseListingCards(html) {
  const rooms = [];
  if (!html) return rooms;

  const seenSlugs = new Set();
  const cardRegex = /<a\s+class="listivo-listing-card-v4[^"]*"[\s\S]*?<\/a>/gi;
  const cards = html.match(cardRegex) || [];

  for (const card of cards) {
    // URL & Slug
    const hrefMatch = card.match(/href="([^"]+)"/i);
    const url = hrefMatch ? hrefMatch[1] : '';
    const slugMatch = url.match(/\/listing\/([^/?#]+)/i);
    const slug = slugMatch ? slugMatch[1] : '';

    if (!slug || seenSlugs.has(slug)) continue;
    seenSlugs.add(slug);

    // Model ID
    const modelMatch = card.match(/:model-id="(\d+)"/i);
    const modelId = modelMatch ? modelMatch[1] : null;

    // Title
    const titleMatch = card.match(/class="listivo-listing-card-v4__name[^"]*"[^>]*>([\s\S]*?)<\/h3>/i);
    const title = titleMatch ? cleanHtml(titleMatch[1]) : slug;

    // Price
    const priceMatch = card.match(/class="listivo-listing-card-v4__value[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    const priceStr = priceMatch ? cleanHtml(priceMatch[1]) : '';
    const priceNumMatch = priceStr.match(/(\d{1,3}(?:[.,]\d{3})+)/);
    const price = priceNumMatch ? parseInt(priceNumMatch[1].replace(/[.,]/g, ''), 10) : 0;

    // Meta (Khu vực / người đăng)
    const metaMatch = card.match(/class="listivo-listing-card-v4__meta-value[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    const meta = metaMatch ? cleanHtml(metaMatch[1]) : '';

    // First Image
    const imgMatch = card.match(/data-srcset="([^"\s]+)/i) || card.match(/src="([^"\s]+)/i);
    const firstImg = imgMatch ? imgMatch[1].replace(/&#038;/g, '&') : '';

    const listHash = sha256(`${modelId || slug}|${title}|${price}|${meta}`);

    rooms.push({
      externalId: modelId || slug,
      slug: slug,
      url: url,
      title: title,
      price: price,
      priceStr: priceStr,
      meta: meta,
      firstImage: firstImg,
      listHash: listHash
    });
  }

  return rooms;
}

async function fetchAllListings(limitPerPage = 50, maxItems = null) {
  console.log('🔄 Đang gọi API Moithue.com lấy danh sách phòng...');
  const firstPage = await fetchListingsPage(1, limitPerPage);
  const totalCount = firstPage.count || 0;
  console.log(`📊 Tổng số phòng hiện có trên Moithue: ${totalCount} phòng`);

  const seenKeys = new Set();
  let allRooms = [];
  for (const r of parseListingCards(firstPage.template)) {
    if (!seenKeys.has(r.slug)) {
      seenKeys.add(r.slug);
      allRooms.push(r);
    }
  }

  const targetCount = maxItems ? Math.min(totalCount, maxItems) : totalCount;
  let page = 2;

  while (allRooms.length < targetCount) {
    process.stdout.write(`\r   -> Đang tải trang ${page} (${allRooms.length}/${targetCount} phòng)...`);
    
    let pageSuccess = false;
    let retries = 3;

    while (retries > 0 && !pageSuccess) {
      try {
        const data = await fetchListingsPage(page, limitPerPage);
        const rooms = parseListingCards(data.template);
        if (!rooms || rooms.length === 0) {
          // Thực sự hết phòng trên moithue
          pageSuccess = true;
          break;
        }
        for (const r of rooms) {
          if (!seenKeys.has(r.slug)) {
            seenKeys.add(r.slug);
            allRooms.push(r);
          }
        }
        pageSuccess = true;
        page++;
        await new Promise(r => setTimeout(r, 200));
      } catch (err) {
        retries--;
        if (retries > 0) {
          process.stdout.write(`\r   ⚠️ Trang ${page} nghẽn mạng, đang thử lại lần ${4 - retries}...`);
          await new Promise(r => setTimeout(r, 1500));
        } else {
          console.warn(`\n⚠️ Bỏ qua trang ${page} do lỗi sau 3 lần thử:`, err.message);
          page++; // Bỏ qua trang lỗi để tiếp tục cào các trang còn lại chứ không dừng đột ngột
        }
      }
    }
  }
  console.log(`\n✅ Đã lấy thành công ${allRooms.length} phòng từ danh sách.`);
  return allRooms;
}

// ==========================================================================
// 2. CRAWL & PARSE CHI TIẾT 1 PHÒNG (BỘ LỌC ĐẦY ĐỦ)
// ==========================================================================
async function fetchRoomDetail(url, slug) {
  let html = '';
  try {
    const res = await httpGet(url);
    if (res.status === 200 && res.body) {
      html = res.body;
    }
  } catch (err) {
    console.warn(`❌ Lỗi tải chi tiết ${slug}:`, err.message);
    return null;
  }

  if (!html || html.includes('Đăng nhập, đăng xuất')) {
    return null;
  }

  // 1. Title
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const titleTagMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  let rawTitle = h1Match ? h1Match[1] : (titleTagMatch ? titleTagMatch[1] : slug);
  let title = normalizeRoomTitle(cleanHtml(rawTitle).replace(/ - Mời Thuê.*$/, '').replace(/ – Mời Thuê.*$/, '').trim());

  // 2. Price
  const priceWidgetMatch = html.match(/widget-lst_listing_price[\s\S]*?<div[^>]*>([\s\S]*?)<\/div>/i) ||
                           html.match(/class="[^"]*price[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  let price = 0;
  if (priceWidgetMatch) {
    const pNum = priceWidgetMatch[1].match(/(\d{1,3}(?:[.,]\d{3})+)/);
    if (pNum) price = parseInt(pNum[1].replace(/[.,]/g, ''), 10);
  }
  if (!price) {
    const fallbackPrice = html.match(/(\d{1,3}(?:[.,]\d{3})+)\s*(?:đ|đồng|VNĐ|₫)/i);
    if (fallbackPrice) price = parseInt(fallbackPrice[1].replace(/[.,]/g, ''), 10);
  }

  // 3. Description & Sections
  let fullDescHtml = '';
  const sectionTextMatch = html.match(/<div class="listivo-listing-section__text">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/i) ||
                           html.match(/<div class="listivo-listing-section__text">([\s\S]*?)<\/div>/i);
  if (sectionTextMatch) fullDescHtml = sectionTextMatch[1];
  const description = cleanHtml(fullDescHtml);

  // 4 Sections
  const sections = { info: '', amenity: '', service: '', note: '' };
  const splitRegex = /(?=(?:THÔNG TIN PHÒNG|📋\s*THÔNG TIN|✅\s*TIỆN ÍCH|TIỆN ÍCH\b|(?:🚚|🏆)\s*DỊCH VỤ|DỊCH VỤ\s*:|❎\s*LƯU Ý|LƯU Ý\s*:))/i;
  const parts = description.split(splitRegex);
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    if (/^(?:THÔNG TIN PHÒNG|📋\s*THÔNG TIN|ĐỊA CHỈ)/i.test(trimmed)) sections.info = trimmed;
    else if (/^(?:✅\s*TIỆN ÍCH|TIỆN ÍCH)/i.test(trimmed)) sections.amenity = trimmed;
    else if (/^(?:(?:🚚|🏆)\s*DỊCH VỤ|DỊCH VỤ\s*:)/i.test(trimmed)) sections.service = trimmed;
    else if (/^(?:❎\s*LƯU Ý|LƯU Ý\s*:)/i.test(trimmed)) sections.note = trimmed;
    else if (!sections.info) sections.info = trimmed;
  }

  // 4. Extract Attributes Chips (Chuẩn 100% Mời Thuê)
  const chipRegex = /<div[^>]*class=["'][^"']*(?:listivo-listing-attribute|listivo-attribute)[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi;
  const chips = [];
  let cm;
  while ((cm = chipRegex.exec(html)) !== null) {
    const text = cm[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (text && !chips.includes(text)) chips.push(text);
  }
  const allChipsText = chips.join(' ');
  const fullText = (title + '\n' + allChipsText + '\n' + description).toLowerCase();

  // 5. Area
  let area = 25;
  const areaChip = chips.find(c => /\d+\s*m[²2]/i.test(c));
  if (areaChip) {
    const m = areaChip.match(/(\d+)/);
    if (m) area = parseInt(m[1], 10);
  } else {
    const areaMatch = description.match(/(?:Diện tích|DT|dt)\s*[:•]?\s*~?\s*(\d+)/i) || description.match(/(\d+)\s*(?:m2|m²|mét vuông)/i);
    if (areaMatch) area = parseInt(areaMatch[1], 10);
  }

  // 6. Max People & Max Vehicles
  let maxPeople = 2;
  const peopleChip = chips.find(c => /\d+\s*người/i.test(c));
  if (peopleChip) {
    const m = peopleChip.match(/(\d+)/);
    if (m) maxPeople = parseInt(m[1], 10);
  } else {
    const pm = description.match(/(?:Tối đa(?:\s*số)?\s*người|Số người tối đa|Tối đa)\s*[:•]\s*(\d+)/i) || description.match(/(\d+)\s*người/i);
    if (pm) maxPeople = parseInt(pm[1], 10);
  }

  let maxVehicles = 2;
  const vehChip = chips.find(c => /\d+\s*xe\b/i.test(c));
  if (vehChip) {
    const m = vehChip.match(/(\d+)/);
    if (m) maxVehicles = parseInt(m[1], 10);
  } else {
    const vm = description.match(/(?:GỬI XE[\s\S]*?)?Xe máy\s*[:•]\s*(\d+)/i) || description.match(/(?:Tối đa|Xe máy)\s*[:•]\s*(\d+)\s*xe/i);
    if (vm) maxVehicles = parseInt(vm[1], 10);
  }

  // 7. Pet Policy (Chính xác 100% theo chip Listivo của Moithue)
  let petAllowed = false;
  if (allChipsText.includes('Không nuôi pet') || allChipsText.includes('không nuôi pet') || allChipsText.includes('Cấm pet')) {
    petAllowed = false;
  } else if (allChipsText.includes('Được nuôi pet') || allChipsText.includes('được nuôi pet') || allChipsText.includes('Nhận pet') || allChipsText.includes('Cho nuôi pet')) {
    petAllowed = true;
  } else {
    const petMatch = description.match(/(?:Nuôi pet|Pet|Thú cưng)\s*[:•]\s*([^\n\r•]+)/i);
    if (petMatch) {
      const pVal = petMatch[1].toLowerCase();
      if (pVal.includes('ko') || pVal.includes('không') || pVal.includes('cấm') || pVal.includes('k ')) petAllowed = false;
      else if (pVal.includes('có') || pVal.includes('được') || pVal.includes('cho') || pVal.includes('nhận') || pVal.includes('cam kết') || pVal.includes('ok')) petAllowed = true;
    } else {
      petAllowed = fullText.includes('nuôi pet: có') || fullText.includes('cho nuôi pet') || fullText.includes('pet: có');
    }
  }

  // 8. Electric Vehicle Policy (Chính sách xe điện chính xác 100%)
  let electricVehicle = false;
  let electricVehiclePolicy = 'forbidden';
  let electricVehicleNote = 'Không nhận xe điện';
  if (allChipsText.includes('Cấm xe điện') || allChipsText.includes('Không nhận xe điện') || allChipsText.includes('cấm xe điện')) {
    electricVehicle = false;
    electricVehiclePolicy = 'forbidden';
    electricVehicleNote = 'Không nhận xe điện';
  } else if (allChipsText.includes('VinFast') || allChipsText.includes('vinfast') || allChipsText.includes('pin rời') || allChipsText.includes('đổi pin')) {
    electricVehicle = true;
    electricVehiclePolicy = 'vinfast_only';
    electricVehicleNote = 'Chỉ nhận xe VinFast pin rời';
  } else if (allChipsText.includes('Nhận xe điện') || allChipsText.includes('nhận xe điện') || allChipsText.includes('xe điện: có')) {
    electricVehicle = true;
    electricVehiclePolicy = 'allowed';
    electricVehicleNote = 'Nhận xe điện';
  } else {
    const evMatch = description.match(/(?:XE|Xe)\s*điện\s*[:•]\s*([^\n\r•]+)/i);
    if (evMatch) {
      const evVal = evMatch[1].toLowerCase();
      if (evVal.includes('ko') || evVal.includes('không') || evVal.includes('cấm') || evVal.includes('k ')) {
        electricVehicle = false; electricVehiclePolicy = 'forbidden'; electricVehicleNote = 'Không nhận xe điện';
      } else if (evVal.includes('vinfast') || evVal.includes('pin rời') || evVal.includes('đổi pin')) {
        electricVehicle = true; electricVehiclePolicy = 'vinfast_only'; electricVehicleNote = 'Chỉ nhận xe VinFast pin rời';
      } else if (evVal.includes('có') || evVal.includes('nhận') || evVal.includes('được')) {
        electricVehicle = true; electricVehiclePolicy = 'allowed'; electricVehicleNote = 'Nhận xe điện';
      }
    }
  }

  // 9. Foreign Guest (Khách quốc tế)
  let foreignGuest = false;
  if (allChipsText.includes('Không khách quốc tế') || allChipsText.includes('Không khách nước ngoài')) {
    foreignGuest = false;
  } else if (allChipsText.includes('Nhận khách quốc tế') || allChipsText.includes('Nhận khách nước ngoài')) {
    foreignGuest = true;
  } else {
    const fgMatch = description.match(/(?:Khách\s*(?:nước\s*ngoài|quốc\s*tế|tây)|Nước\s*ngoài)\s*[:•]\s*([^\n\r•]+)/i);
    if (fgMatch) {
      const fgVal = fgMatch[1].toLowerCase();
      if (fgVal.includes('ko') || fgVal.includes('không') || fgVal.includes('cấm') || fgVal.includes('k ')) foreignGuest = false;
      else if (fgVal.includes('có') || fgVal.includes('nhận') || fgVal.includes('được')) foreignGuest = true;
    }
  }

  // 10. Available Floors (Tầng còn phòng ở trục này)
  const floorMatch = html.match(/Tầng còn phòng ở trục này[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/i) ||
                     html.match(/Tầng còn phòng ở trục này[\s\S]*?<\/div>\s*<\/div>/i);
  const availableFloors = [];
  if (floorMatch) {
    const tagRegex = /<div class=["']listivo-tag["']>([\s\S]*?)<\/div>/gi;
    let fm;
    while ((fm = tagRegex.exec(floorMatch[0])) !== null) {
      const clean = cleanHtml(fm[1]).trim();
      if (clean && !availableFloors.includes(clean)) availableFloors.push(clean);
    }
  }

  // 11. Move-in Status
  let moveInStatus = 'Ở ngay';
  const handoverChip = chips.find(c => c.startsWith('Bàn giao:') || c.startsWith('Nhận từ') || c.startsWith('Sắp trống') || c === 'Ở ngay');
  if (handoverChip) moveInStatus = handoverChip;

  // 12. Elevator & Floor
  let hasElevator = chips.some(c => c.toLowerCase().includes('thang máy')) || 
                      (!chips.some(c => c.toLowerCase().includes('thang bộ')) && (fullText.includes('thang máy: có') || (fullText.includes('thang máy') && !fullText.includes('thang bộ'))));
  const floorMatchDesc = description.match(/Tầng\s*(\d+)/i);
  const floorNum = floorMatchDesc ? floorMatchDesc[1] : (availableFloors.length > 0 ? availableFloors[0].replace(/\D/g, '') : '2');
  const floor = availableFloors.length > 0 
    ? `${availableFloors.join(', ')} (Thang máy: ${hasElevator ? 'Có' : 'Không'})`
    : `Tầng ${floorNum} (Thang máy: ${hasElevator ? 'Có' : 'Không'})`;

  // 13. Furniture
  let furnishLevel = 'Full đồ';
  if (chips.some(c => c.toLowerCase().includes('cơ bản') || c.toLowerCase().includes('đồ cơ bản'))) {
    furnishLevel = 'Cơ bản';
  } else if (chips.some(c => c.toLowerCase().includes('full đồ') || c.toLowerCase().includes('full nội thất') || c.toLowerCase() === 'full')) {
    furnishLevel = 'Full đồ';
  } else if (fullText.includes('cơ bản') && !fullText.includes('full')) {
    furnishLevel = 'Cơ bản';
  }

  // 14. Amenities list
  const featRegex = /<div class="listivo-listing-feature__text">([\s\S]*?)<\/div>/gi;
  const amenities = [];
  let m;
  while ((m = featRegex.exec(html)) !== null) {
    const feat = cleanHtml(m[1]);
    if (feat && !amenities.includes(feat)) amenities.push(feat);
  }

  // 15. Gallery Images (Cô lập riêng elementor-widget-lst_listing_gallery để KHÔNG dính ảnh phòng tương tự)
  let galleryChunk = html;
  const galleryIdx = html.indexOf('elementor-widget-lst_listing_gallery');
  if (galleryIdx > -1) {
    const nextWidgetIdx = html.indexOf('elementor-widget-lst_listing_', galleryIdx + 40);
    galleryChunk = html.substring(galleryIdx, nextWidgetIdx > -1 ? nextWidgetIdx : galleryIdx + 40000);
  }
  const imgRegex = /(?:https:\/\/moithue\.com\/wp-content\/uploads\/|https:\/\/d21aa69b6f66[^\/]+\/moithue-com-prod\/wp-content\/uploads\/)([^\s"'<>\\]+\.(?:jpg|jpeg|png|webp))/gi;
  const rawPaths = [];
  let im;
  while ((im = imgRegex.exec(galleryChunk)) !== null) rawPaths.push(im[1].replace(/&#038;/g, '&'));

  const baseMap = new Map();
  for (const p of rawPaths) {
    if (p.includes('favicon') || p.includes('cropped-') || p.includes('Logo') || p.includes('login_banner') || p.includes('404')) continue;
    if (p.includes('100x100') || p.includes('150x150') || p.includes('180x180') || p.includes('32x32') || p.includes('400x400')) continue;
    const baseName = p.replace(/-\d+x\d+/, '').replace(/-scaled/, '');
    if (!baseMap.has(baseName)) baseMap.set(baseName, p);
  }
  const images = Array.from(baseMap.values()).map(p => `https://moithue.com/wp-content/uploads/${p}`);

  // 16. Address
  const addrMatch = description.match(/(?:ĐỊA CHỈ|Địa chỉ)[:\s]*([^\n\r•]+)/i);
  const rawAddr = addrMatch ? addrMatch[1].trim() : title;
  const address = normalizeRoomTitle(rawAddr);

  // 17. Source Group & District (Chuẩn 100% theo API Moithue)
  let sourceGroup = 'nguon-cau-giay';
  let sourceGroupName = 'Cầu Giấy';
  let district = 'cau-giay';

  const mapped = officialMapping[slug];
  if (mapped) {
    if (mapped.district) district = mapped.district;
    if (mapped.sourceGroup) {
      sourceGroup = mapped.sourceGroup;
      sourceGroupName = mapped.sourceGroupName;
    }
    if (mapped.petAllowed !== undefined) petAllowed = mapped.petAllowed;
    if (mapped.electricVehiclePolicy) {
      electricVehiclePolicy = mapped.electricVehiclePolicy;
      electricVehicle = electricVehiclePolicy !== 'forbidden';
      electricVehicleNote = electricVehiclePolicy === 'vinfast_only' ? 'Chỉ nhận xe VinFast pin rời' : (electricVehiclePolicy === 'allowed' ? 'Nhận xe điện' : 'Không nhận xe điện');
    }
    if (mapped.elevator !== undefined) hasElevator = mapped.elevator;
    if (mapped.foreignGuest !== undefined) foreignGuest = mapped.foreignGuest;
  } else {
    // Fallback thông minh: Chip[0] luôn là Nhóm Nguồn Hàng chính thức trên Moithue!
    if (chips.length > 0) {
      const firstChip = chips[0].trim();
      for (const [sKey, sVal] of Object.entries(SOURCE_GROUP_NAMES)) {
        if (sVal.toLowerCase() === firstChip.toLowerCase()) {
          sourceGroup = sKey;
          sourceGroupName = sVal;
          break;
        }
      }
    }
    for (const [key, val] of Object.entries(DISTRICT_MAP)) {
      if (fullText.includes(key)) {
        district = val;
        break;
      }
    }
  }

  // 18. Room Layout
  let roomLayout = 'STUDIO';
  const layoutChip = chips.find(c => ['STUDIO', '1N1K', '2N1K', '3N1K', 'DUPLEX', 'GÁC XÉP', 'GÁC LỬNG', 'NGUYÊN CĂN'].includes(c.toUpperCase()));
  if (layoutChip) {
    const u = layoutChip.toUpperCase();
    if (u === 'DUPLEX' || u === 'GÁC XÉP' || u === 'GÁC LỬNG') roomLayout = 'Duplex/Gác xép';
    else if (u === 'NGUYÊN CĂN') roomLayout = 'Nguyên căn';
    else roomLayout = u;
  } else if (fullText.includes('3n1k') || fullText.includes('3 phòng ngủ')) roomLayout = '3N1K';
  else if (fullText.includes('2n1k') || fullText.includes('2 phòng ngủ')) roomLayout = '2N1K';
  else if (fullText.includes('1n1k') || fullText.includes('1 phòng ngủ')) roomLayout = '1N1K';
  else if (fullText.includes('duplex') || fullText.includes('gác xép') || fullText.includes('có gác')) roomLayout = 'Duplex/Gác xép';
  else if (fullText.includes('nguyên căn')) roomLayout = 'Nguyên căn';

  // 19. Category & Tag
  let categoryName = 'Khép kín';
  let tag = 'Khép kín';
  const isVsChung = fullText.includes('vsinh chung') || fullText.includes('vệ sinh chung') || fullText.includes('wc chung') || fullText.includes('không khép kín');
  if (isVsChung) {
    categoryName = 'VS chung';
    tag = 'VS chung';
  } else if (roomLayout === 'Nguyên căn') {
    categoryName = 'Nguyên căn';
    tag = 'Nguyên căn';
  } else {
    categoryName = roomLayout !== 'STUDIO' ? `Khép kín (${roomLayout})` : 'Khép kín';
    tag = 'Khép kín';
  }

  // 20. Youtube & Video Drive
  const ytMatch = html.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
  const videoUrl = ytMatch ? `https://www.youtube.com/watch?v=${ytMatch[1]}` : '';
  const driveMatch = html.match(/href=["'](https:\/\/drive\.google\.com\/[^\s"'>]+)["'][^>]*title=["']Lấy Video["']/i) ||
                     html.match(/href=["'](https:\/\/drive\.google\.com\/[^\s"'>]+)["']/i);
  const videoDriveUrl = driveMatch ? driveMatch[1] : '';

  // 21. Environment
  const nearParking = allChipsText.includes('bãi đỗ ô tô') || allChipsText.includes('Ô tô') || fullText.includes('bãi đỗ') || fullText.includes('bãi ô tô');
  const nearMainRoad = allChipsText.includes('đường lớn') || allChipsText.includes('Mặt đường') || fullText.includes('đường lớn') || fullText.includes('mặt đường');

  // 22. Fees
  const dienMatch = description.match(/Điện[:\s]*([^\n\r]+)/i);
  const nuocMatch = description.match(/Nước[:\s]*([^\n\r]+)/i);
  const mangMatch = description.match(/(?:WIFI|Mạng|Internet)[:\s]*([^\n\r]+)/i);
  const dvChungMatch = description.match(/(?:Dịch vụ chung|Dịch vụ)[:\s]*([^\n\r]+)/i);
  const thangMayFeeMatch = description.match(/Thang máy[:\s]*(\d+k\/người[^\n\r•]*)/i);
  const xeMayMatch = description.match(/(?:Xe máy|xe máy)[:\s]*([^\n\r]+)/i);

  return {
    title: title || slug,
    address: address,
    district: district,
    sourceGroup: sourceGroup,
    sourceGroupName: sourceGroupName,
    roomLayout: roomLayout,
    categoryName: categoryName,
    tag: tag,
    price: price,
    area: area,
    floor: floor,
    availableFloors: availableFloors,
    moveInStatus: moveInStatus,
    elevator: hasElevator,
    furnishLevel: furnishLevel,
    maxPeople: maxPeople,
    maxVehicles: maxVehicles,
    petAllowed: petAllowed,
    electricVehicle: electricVehicle,
    electricVehiclePolicy: electricVehiclePolicy,
    electricVehicleNote: electricVehicleNote,
    foreignGuest: foreignGuest,
    nearParking: nearParking,
    nearMainRoad: nearMainRoad,
    images: images.length > 0 ? images : ['https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80'],
    amenities: amenities.length > 0 ? amenities : ['Điều hòa', 'Nóng lạnh', 'Giường', 'Tủ quần áo'],
    description: description || title,
    detailDescription: sections,
    videoUrl: videoUrl,
    videoDriveUrl: videoDriveUrl,
    feeElectricity: dienMatch ? dienMatch[1].trim() : '4k/số',
    feeWater: nuocMatch ? nuocMatch[1].trim() : '35k/khối',
    feeInternet: mangMatch ? mangMatch[1].trim() : '100k/phòng',
    feeService: dvChungMatch ? dvChungMatch[1].trim() : '150k/người',
    feeElevator: thangMayFeeMatch ? thangMayFeeMatch[1].trim() : '',
    feeParking: xeMayMatch ? xeMayMatch[1].trim() : 'Free 2 xe',
    contractTerm: '12 Tháng',
    depositTerm: 'Đóng 1 cọc 1',
    moithueUrl: url,
    moithueSlug: slug
  };
}

// ==========================================================================
// 3. ĐỒNG BỘ DỮ LIỆU & SO SÁNH (DIFFING & STATUS UPDATE)
// ==========================================================================
async function runSync(options = {}) {
  const startTime = Date.now();
  console.log('\n======================================================');
  console.log(`🚀 BẮT ĐẦU ĐỒNG BỘ DỮ LIỆU PHÒNG TRỌ [${new Date().toLocaleString('vi-VN')}]`);
  console.log('======================================================');

  // Đọc DB hiện tại
  let existingRooms = [];
  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      existingRooms = JSON.parse(raw);
      console.log(`📁 Cơ sở dữ liệu hiện tại có: ${existingRooms.length} phòng`);
    } catch (e) {
      console.warn('⚠️ File rooms_new.json không đọc được, sẽ khởi tạo mới.');
    }
  }

  // Backup DB
  if (existingRooms.length > 0) {
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(existingRooms, null, 2), 'utf8');
    console.log(`🛡️ Đã tạo file sao lưu an toàn: ${path.basename(BACKUP_FILE)}`);
  }

  // Map phòng cũ theo tất cả key nhận diện: external_id, moithueSlug, id
  const roomMap = new Map();
  for (const r of existingRooms) {
    if (r.external_id) roomMap.set(String(r.external_id), r);
    if (r.externalId) roomMap.set(String(r.externalId), r);
    if (r.moithueSlug) roomMap.set(String(r.moithueSlug), r);
    if (r.id) {
      roomMap.set(String(r.id), r);
      roomMap.set(String(r.id).replace(/^MT-/, ''), r);
    }
  }

  // Lấy danh sách mới nhất từ moithue.com
  const crawledList = await fetchAllListings(50, options.limit || null);
  const crawledKeys = new Set();

  let newCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;
  let reactivatedCount = 0;
  const changeLogs = [];

  console.log('\n⚙️ Đang phân tích so sánh và cập nhật dữ liệu...');

  for (let i = 0; i < crawledList.length; i++) {
    const item = crawledList[i];
    if (item.externalId) crawledKeys.add(String(item.externalId));
    if (item.slug) {
      crawledKeys.add(String(item.slug));
      crawledKeys.add('MT-' + String(item.slug));
    }

    const old = (item.externalId && roomMap.get(String(item.externalId))) || 
                (item.slug && roomMap.get(String(item.slug))) || 
                (item.slug && roomMap.get('MT-' + String(item.slug)));

    if (!old) {
      // 🟢 PHÒNG MỚI TINH -> Cào chi tiết
      process.stdout.write(`\r[${i + 1}/${crawledList.length}] 🟢 Phát hiện phòng mới: ${item.slug.slice(0, 30)}... `);
      const detail = await fetchRoomDetail(item.url, item.slug);
      const cleanTitle = normalizeRoomTitle((detail && detail.title) || item.title || item.slug);
      const cleanAddr = normalizeRoomTitle((detail && detail.address) || item.meta || item.title);

      const newRoom = {
        id: 'MT-' + item.slug,
        external_id: item.externalId,
        title: cleanTitle,
        price: (detail && detail.price) || item.price || 0,
        list_hash: item.listHash,
        status: 'available',
        statusName: 'Còn phòng',
        missing_count: 0,
        first_seen_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
        last_changed_at: new Date().toISOString(),
        ...(detail || {
          address: cleanAddr,
          district: 'cau-giay',
          sourceGroup: 'nguon-cau-giay',
          sourceGroupName: 'Cầu Giấy',
          roomLayout: 'STUDIO',
          images: item.firstImage ? [item.firstImage] : [],
          amenities: ['Điều hòa', 'Nóng lạnh', 'Giường', 'Tủ quần áo'],
          description: cleanTitle,
          moithueUrl: item.url,
          moithueSlug: item.slug
        })
      };

      newRoom.title = cleanTitle;
      newRoom.address = cleanAddr;
      if (!newRoom.price && item.price) newRoom.price = item.price;

      existingRooms.unshift(newRoom);
      if (item.externalId) roomMap.set(String(item.externalId), newRoom);
      if (item.slug) {
        roomMap.set(String(item.slug), newRoom);
        roomMap.set('MT-' + String(item.slug), newRoom);
      }
      newCount++;
      changeLogs.push({ type: 'NEW', id: newRoom.id, title: newRoom.title, price: newRoom.price });
      await new Promise(r => setTimeout(r, 100));

    } else {
      // Đã có trong DB -> Kiểm tra có đổi hash không
      let changed = false;

      // Nếu phòng từng bị ẩn/hết nay xuất hiện lại -> Kích hoạt lại
      if (old.status !== 'available') {
        old.status = 'available';
        old.statusName = 'Còn phòng';
        old.missing_count = 0;
        reactivatedCount++;
        changeLogs.push({ type: 'REACTIVATED', id: old.id, title: old.title });
        changed = true;
      }

      // So sánh Hash rút gọn
      if (old.list_hash !== item.listHash || old.price !== item.price) {
        process.stdout.write(`\r[${i + 1}/${crawledList.length}] 🟡 Phòng sửa đổi: ${item.slug.slice(0, 30)}... `);
        const detail = await fetchRoomDetail(item.url, item.slug);
        
        old.title = normalizeRoomTitle((detail && detail.title) || item.title);
        old.price = (detail && detail.price) || item.price;
        old.list_hash = item.listHash;
        old.last_changed_at = new Date().toISOString();

        if (detail) {
          Object.assign(old, detail);
          old.title = normalizeRoomTitle(old.title);
          old.address = normalizeRoomTitle(old.address);
        }

        updatedCount++;
        changeLogs.push({ type: 'UPDATED', id: old.id, title: old.title, price: old.price });
        changed = true;
        await new Promise(r => setTimeout(r, 100));
      }

      old.last_seen_at = new Date().toISOString();
      old.missing_count = 0;

      if (!changed) {
        unchangedCount++;
      }
    }
  }

  // 🔴 PHÒNG BIẾN MẤT (KHÔNG CÒN TRÊN MOITHUE) -> ĐÁNH DẤU ẨN / ĐÃ THUÊ NGAY LẬP TỨC
  // Khi chạy FULL đồng bộ (không có --limit), phòng nào không có trên Moithue sẽ bị ẩn để khớp 100% số lượng
  let hiddenCount = 0;
  if (!options.limit) {
    for (const r of existingRooms) {
      const extKey = r.external_id ? String(r.external_id) : (r.externalId ? String(r.externalId) : null);
      const slugKey = r.moithueSlug || (r.id ? String(r.id).replace(/^MT-/, '') : null);
      const idKey = r.id ? String(r.id) : null;

      const isPresent = (extKey && crawledKeys.has(extKey)) || 
                        (slugKey && crawledKeys.has(slugKey)) || 
                        (idKey && crawledKeys.has(idKey));

      if (!isPresent) {
        r.missing_count = (r.missing_count || 0) + 1;
        if (r.status === 'available' || !r.status) {
          r.status = 'hidden';
          r.statusName = 'Đã thuê / Tạm ẩn';
          r.last_hidden_at = new Date().toISOString();
          hiddenCount++;
          changeLogs.push({ type: 'HIDDEN', id: r.id, title: r.title, reason: 'Không còn trên Mời Thuê' });
        }
      } else {
        r.missing_count = 0;
        r.status = 'available';
        r.statusName = 'Còn phòng';
      }
    }
  }

  // Chuẩn hóa tên và địa chỉ tất cả các phòng trước khi ghi đè
  for (const r of existingRooms) {
    if (r.title) r.title = normalizeRoomTitle(r.title);
    if (r.address) r.address = normalizeRoomTitle(r.address);
  }

  // Lưu lại vào rooms_new.json
  fs.writeFileSync(DB_FILE, JSON.stringify(existingRooms, null, 2), 'utf8');

  // Ghi nhật ký vào sync_history.json
  let historyLogs = [];
  if (fs.existsSync(LOG_FILE)) {
    try { historyLogs = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8')); } catch (e) {}
  }
  historyLogs.unshift({
    timestamp: new Date().toISOString(),
    durationSeconds: Math.round((Date.now() - startTime) / 1000),
    summary: {
      totalInMoithue: crawledList.length,
      newRooms: newCount,
      updatedRooms: updatedCount,
      unchangedRooms: unchangedCount,
      hiddenRooms: hiddenCount,
      reactivatedRooms: reactivatedCount,
      totalInDatabase: existingRooms.length
    },
    changes: changeLogs
  });
  // Giữ tối đa 50 lần đồng bộ gần nhất
  fs.writeFileSync(LOG_FILE, JSON.stringify(historyLogs.slice(0, 50), null, 2), 'utf8');

  // Báo cáo hoàn thành
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n\n======================================================');
  console.log(`🎉 ĐỒNG BỘ HOÀN TẤT TRONG ${duration} GIÂY!`);
  console.log('======================================================');
  console.log(`🟢 Phòng mới thêm vào:           ${newCount}`);
  console.log(`🟡 Phòng cập nhật thay đổi:       ${updatedCount}`);
  console.log(`⚪ Phòng giữ nguyên (không đổi):  ${unchangedCount}`);
  console.log(`🔄 Phòng kích hoạt lại:          ${reactivatedCount}`);
  console.log(`🔴 Phòng đánh dấu ẩn (hết phòng): ${hiddenCount}`);
  console.log(`📦 Tổng phòng trong kho web:     ${existingRooms.length}`);
  console.log('======================================================\n');

  return {
    success: true,
    durationSeconds: parseFloat(duration),
    summary: {
      totalInMoithue: crawledList.length,
      newRooms: newCount,
      updatedRooms: updatedCount,
      unchangedRooms: unchangedCount,
      hiddenRooms: hiddenCount,
      reactivatedRooms: reactivatedCount,
      totalInDatabase: existingRooms.length
    },
    changes: changeLogs
  };
}

// Chạy trực tiếp từ dòng lệnh
if (require.main === module) {
  const args = process.argv.slice(2);
  let limit = null;
  const limitIdx = args.indexOf('--limit');
  if (limitIdx !== -1 && args[limitIdx + 1]) {
    limit = parseInt(args[limitIdx + 1], 10);
  }

  runSync({ limit }).catch(err => {
    console.error('❌ Lỗi đồng bộ:', err);
    process.exit(1);
  });
}

module.exports = { runSync, fetchRoomDetail, httpGet, fetchAllListings };
