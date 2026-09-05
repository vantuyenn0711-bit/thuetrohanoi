#!/usr/bin/env node
// ==========================================================================
// SIMPLE LOCAL SERVER FOR ADMIN PANEL
// Usage: node server.js
// Then open: http://localhost:3000/admin.html
// ==========================================================================

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const CREDENTIALS = { email: 'Phonghuyentran.moithue@gmail.com', password: 'Huyentran' };
let cookies = {};

// ======================================================================
// HTTP HELPERS (reused from fetch_listing.js)
// ======================================================================
function httpGet(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8',
        'Cookie': Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ')
      },
      timeout: 15000
    };
    const req = https.request(options, (res) => {
      const setCookies = res.headers['set-cookie'] || [];
      setCookies.forEach(c => {
        const [kv] = c.split(';');
        const [k, ...vParts] = kv.split('=');
        cookies[k.trim()] = vParts.join('=');
      });
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && maxRedirects > 0) {
        const redirectUrl = res.headers.location.startsWith('http') ? res.headers.location : `https://${parsedUrl.hostname}${res.headers.location}`;
        resolve(httpGet(redirectUrl, maxRedirects - 1));
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

function httpPost(url, postData) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const data = Object.entries(postData).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
    const options = {
      hostname: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.pathname,
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(data),
        'Cookie': Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ')
      },
      timeout: 15000
    };
    const req = https.request(options, (res) => {
      const setCookies = res.headers['set-cookie'] || [];
      setCookies.forEach(c => {
        const [kv] = c.split(';');
        const [k, ...vParts] = kv.split('=');
        cookies[k.trim()] = vParts.join('=');
      });
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(data);
    req.end();
  });
}

// ======================================================================
// LOGIN
// ======================================================================
async function login() {
  if (Object.keys(cookies).some(k => k.startsWith('wordpress_logged_in_'))) return true;
  console.log('🔑 Logging into moithue.com...');
  await httpGet('https://moithue.com/wp-login.php');
  await httpPost('https://moithue.com/wp-login.php', {
    log: CREDENTIALS.email, pwd: CREDENTIALS.password,
    'wp-submit': 'Đăng nhập', redirect_to: 'https://moithue.com/', testcookie: '1'
  });
  const ok = Object.keys(cookies).some(k => k.startsWith('wordpress_logged_in_'));
  console.log(ok ? '✅ Login OK' : '⚠️ Login failed');
  return ok;
}

// ======================================================================
// EXTRACT ROOM DATA FROM HTML (100% FULL PARSER - ZERO OMISSION)
// ======================================================================
function cleanHtmlPreserveBreaks(html) {
  if (!html) return '';
  let text = html
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n• ')
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
    .replace(/&hellip;/g, '...')
    .replace(/&nbsp;|\u00A0/g, ' ')
    .replace(/\r\n|\r/g, '\n');

  // 1. Thêm ngắt dòng trước các icon mục lớn
  text = text.replace(/([^\n])\s*(?=(?:📋|✅|🚚|🏆|❎))/gu, '$1\n\n');

  // 2. Thêm ngắt dòng trước các tiêu đề lớn (kể cả không có emoji)
  text = text.replace(/([^\n])\s*(?=(?:THÔNG TIN PHÒNG|TIỆN ÍCH|DỊCH VỤ|LƯU Ý)(?:[\s:•_]|$))/gi, '$1\n\n');

  // 3. Thêm ngắt dòng trước các thuộc tính quan trọng
  text = text.replace(/([^\n•])\s*(?=(?:ĐỊA CHỈ|Ngõ|Tình trạng|Trống|Diện tích|Thang máy|Dạng phòng|Nội thất|Gần trường|Gần chợ|Gần bãi|(?:(?<!Xe\s*)Điện)|Nước|Internet|Mạng|Dịch vụ chung|Thêm đồ|Bớt đồ|Xe máy|Tối đa|Nuôi pet|Xe điện|Khách tây|Giờ giấc|Chung chủ|Phơi đồ|Máy giặt|Tổng số tầng|Hợp đồng|Thanh toán|Ngày lùi)\s*[:•])/gi, '$1\n');

  // 4. Thêm ngắt dòng trước dấu bullet •
  text = text.replace(/([^\n])\s*•\s*/g, '$1\n• ');

  // 5. Chuẩn hóa khoảng trắng & nhiều dòng trống
  return text.replace(/[ \t]+/g, ' ').replace(/\n\s*\n\s*\n+/g, '\n\n').trim();
}

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

function extractRoomFromHtml(html, slug) {
  const data = { slug, url: `https://moithue.com/listing/${slug}/` };

  // 1. Title
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const titleTagMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const rawTitle = h1Match ? h1Match[1] : (titleTagMatch ? titleTagMatch[1] : slug);
  const cleanedTitle = cleanHtmlPreserveBreaks(rawTitle).replace(/ - Mời Thuê.*$/, '').replace(/ – Mời Thuê.*$/, '').trim();
  data.title = transformMoithueName(cleanedTitle);

  // 2. Price
  const priceWidgetMatch = html.match(/widget-lst_listing_price[\s\S]*?<div[^>]*>([\s\S]*?)<\/div>/i) ||
    html.match(/class="[^"]*price[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  let priceStr = '';
  if (priceWidgetMatch) {
    const pNum = priceWidgetMatch[1].match(/(\d{1,3}(?:[.,]\d{3})+)/);
    if (pNum) priceStr = pNum[1];
  }
  if (!priceStr) {
    const fallbackPrice = html.match(/(\d{1,3}(?:[.,]\d{3})+)\s*(?:đ|đồng|VNĐ|₫)/i);
    if (fallbackPrice) priceStr = fallbackPrice[1];
  }
  data.priceStr = priceStr;

  // 3. Extract 100% FULL Description from container
  let fullDescHtml = '';
  const sectionTextMatch = html.match(/<div class="listivo-listing-section__text">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/i) ||
    html.match(/<div class="listivo-listing-section__text">([\s\S]*?)<\/div>/i) ||
    html.match(/listivo-listing-description[\s\S]*?>([\s\S]*?)<\/div>/i);
  if (sectionTextMatch) {
    fullDescHtml = sectionTextMatch[1];
  } else {
    const moTaIdx = html.indexOf('Mô tả');
    if (moTaIdx > -1) {
      const chunk = html.substring(moTaIdx, moTaIdx + 15000);
      const textMatch = chunk.match(/<div class="listivo-listing-section__text">([\s\S]*?)<\/div>/i);
      if (textMatch) fullDescHtml = textMatch[1];
    }
  }

  const rawDescText = cleanHtmlPreserveBreaks(fullDescHtml);
  const ogDescMatch = html.match(/property="og:description"\s+content="([^"]*)"/i);
  const ogDesc = ogDescMatch ? cleanHtmlPreserveBreaks(ogDescMatch[1]) : '';
  data.description = rawDescText || ogDesc || '';

  // 4. Extract "Trong nhà có gì?" (Features / Amenities)
  const featRegex = /<div class="listivo-listing-feature__text">([\s\S]*?)<\/div>/gi;
  const extractedAmenities = [];
  let m;
  while ((m = featRegex.exec(html)) !== null) {
    const feat = cleanHtmlPreserveBreaks(m[1]).trim();
    if (feat && !extractedAmenities.includes(feat)) {
      extractedAmenities.push(feat);
    }
  }
  data.amenities = extractedAmenities.length > 0 ? extractedAmenities : [
    'Ban công', 'Điều hòa', 'Nóng lạnh', 'Giường', 'Tủ quần áo', 'Bàn bếp', 'Tủ bếp', 'Wifi'
  ];

  // 5. Extract "Tầng còn phòng ở trục này"
  const floorMatch = html.match(/Tầng còn phòng ở trục này[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/i) ||
    html.match(/Tầng còn phòng ở trục này[\s\S]*?<\/div>\s*<\/div>/i);
  const availableFloors = [];
  if (floorMatch) {
    const tagRegex = /<div class=["']listivo-tag["']>([\s\S]*?)<\/div>/gi;
    let m;
    while ((m = tagRegex.exec(floorMatch[0])) !== null) {
      const clean = cleanHtmlPreserveBreaks(m[1]).trim();
      if (clean && !availableFloors.includes(clean)) availableFloors.push(clean);
    }
    if (availableFloors.length === 0) {
      const fallbackTags = floorMatch[0].match(/(?:P\.?\s*\d+|Tầng\s*\d+|\d{3,4})/gi);
      if (fallbackTags) {
        fallbackTags.forEach(f => {
          const c = f.trim();
          if (!availableFloors.includes(c)) availableFloors.push(c);
        });
      }
    }
  }
  data.availableFloors = availableFloors;

  // 6. Extract Video
  const ytMatch = html.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
  if (ytMatch) {
    data.videoUrl = `https://www.youtube.com/watch?v=${ytMatch[1]}`;
    data.videoId = ytMatch[1];
  } else {
    data.videoUrl = '';
  }
  const driveMatch = html.match(/href=["'](https:\/\/drive\.google\.com\/[^\s"'>]+)["'][^>]*title=["']Lấy Video["']/i) ||
    html.match(/href=["'](https:\/\/drive\.google\.com\/[^\s"'>]+)["']/i);
  data.videoDriveUrl = driveMatch ? driveMatch[1] : '';

  // 7. Extract Gallery Images
  const galleryIdx = html.indexOf('elementor-widget-lst_listing_gallery');
  let galleryChunk = html;
  if (galleryIdx > -1) {
    const nextWidgetIdx = html.indexOf('elementor-widget-lst_listing_', galleryIdx + 40);
    galleryChunk = html.substring(galleryIdx, nextWidgetIdx > -1 ? nextWidgetIdx : galleryIdx + 40000);
  }

  const imgUrls = [];
  const imgRegex = /(?:https:\/\/moithue\.com\/wp-content\/uploads\/|https:\/\/d21aa69b6f66[^\/]+\/moithue-com-prod\/wp-content\/uploads\/)([^\s"'<>\\]+\.(?:jpg|jpeg|png|webp))/gi;
  while ((m = imgRegex.exec(galleryChunk)) !== null) {
    imgUrls.push(m[1].replace(/&#038;/g, '&'));
  }

  const baseMap = new Map();
  for (const p of imgUrls) {
    if (p.includes('cropped-') || p.includes('Logo') || p.includes('favicon') || p.includes('login_banner') || p.includes('404')) continue;
    if (p.includes('100x100') || p.includes('150x150') || p.includes('180x180') || p.includes('192x192') || p.includes('270x270') || p.includes('32x32') || p.includes('400x400')) continue;
    const base = p.replace(/-\d+x\d+/, '').replace(/-scaled/, '');
    if (!baseMap.has(base)) {
      baseMap.set(base, p);
    }
  }
  data.images = Array.from(baseMap.values()).map(p => `https://moithue.com/wp-content/uploads/${p}`);
  if (data.images.length === 0) {
    const ogImg = html.match(/property="og:image"\s+content="([^"]*)"/i);
    if (ogImg) data.images = [ogImg[1].replace(/&#038;/g, '&')];
    else data.images = ['https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80'];
  }

  // 8. Extract listivo-listing-attribute Chips (Thẻ thông số trên cùng của moithue.com)
  const chipRegex = /<div[^>]*class=["'][^"']*(?:listivo-listing-attribute|listivo-attribute)[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi;
  const chips = [];
  let cm;
  while ((cm = chipRegex.exec(html)) !== null) {
    const text = cm[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (text && !chips.includes(text)) {
      chips.push(text);
    }
  }
  const allChipsText = chips.join(' ');

  const desc = data.description || '';
  const fullText = (data.title + '\n' + allChipsText + '\n' + desc).toLowerCase();

  // Address
  const addrMatch = desc.match(/(?:ĐỊA CHỈ|Địa chỉ)[:\s]*([^\n\r•]+?)(?=\s*(?:Ngõ|Tình trạng|Trống|Diện tích|Thang máy|Dạng phòng|Nội thất|⏳|🍡|🛋️|✅|🚚|❎|$))/iu);
  const rawAddr = addrMatch ? addrMatch[1].trim() : data.title.split('_')[0].trim();
  const cleanRawAddr = (rawAddr.split('\n')[0] || '').trim();
  data.address = transformMoithueName(cleanRawAddr);

  // 1. Area (Diện tích - Ưu tiên đọc chip "30 m²", sau đó regex mô tả)
  let area = 25;
  const areaChip = chips.find(c => /\d+\s*m[²2]/i.test(c));
  if (areaChip) {
    const m = areaChip.match(/(\d+)/);
    if (m) area = parseInt(m[1], 10);
  } else {
    const areaMatch = desc.match(/(?:Diện tích|DT|dt)\s*[:•]?\s*~?\s*(\d+)/i) || desc.match(/(\d+)\s*(?:m2|m²|mét vuông)/i);
    if (areaMatch) area = parseInt(areaMatch[1], 10);
  }
  data.area = area;

  // 2. Max people (Tối đa số người - Ưu tiên đọc chip "3 người", sau đó regex mô tả)
  let maxPeople = 2;
  const peopleChip = chips.find(c => /\d+\s*người/i.test(c));
  if (peopleChip) {
    const m = peopleChip.match(/(\d+)/);
    if (m) maxPeople = parseInt(m[1], 10);
  } else {
    const maxPeopleMatch = desc.match(/(?:Tối đa(?:\s*số)?\s*người(?:\s*ở)?|Số người tối đa|Tối đa)\s*[:•]\s*(\d+)/i) || desc.match(/(\d+)\s*người(?:\s*ở)?/i);
    if (maxPeopleMatch) maxPeople = parseInt(maxPeopleMatch[1], 10);
  }
  data.maxPeople = maxPeople;

  // 3. Max vehicles (Số xe - Ưu tiên đọc chip "2 xe", sau đó regex mô tả)
  let maxVehicles = 2;
  const vehChip = chips.find(c => /\d+\s*xe\b/i.test(c));
  if (vehChip) {
    const m = vehChip.match(/(\d+)/);
    if (m) maxVehicles = parseInt(m[1], 10);
  } else {
    const maxVehMatch = desc.match(/(?:GỬI XE[\s\S]*?)?Xe máy\s*[:•]\s*(\d+)/i) || desc.match(/(?:Tối đa|Xe máy)\s*[:•]\s*(\d+)\s*xe/i) || desc.match(/(\d+)\s*xe\s*máy/i);
    if (maxVehMatch) maxVehicles = parseInt(maxVehMatch[1], 10);
  }
  data.maxVehicles = maxVehicles;

  // 4. Move-in Status (Bàn giao / Ở ngay - Ưu tiên đọc chip "Bàn giao: 01/10/2026", "Ở ngay", "Sắp trống")
  let moveInStatus = 'Ở ngay';
  const handoverChip = chips.find(c => c.startsWith('Bàn giao:') || c.startsWith('Nhận từ') || c.startsWith('Sắp trống') || c === 'Ở ngay');
  if (handoverChip) {
    moveInStatus = handoverChip;
  } else {
    const handoverMatch = data.title.match(/(?:Nhận\s*(?:từ)?|Bàn\s*giao)\s*[:\s]*(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i) ||
                          desc.match(/(?:Nhận\s*phòng|Bàn\s*giao|Thời\s*gian\s*nhận)\s*[:•]\s*([^\n\r•]+)/i);
    if (handoverMatch) {
      moveInStatus = `Bàn giao: ${handoverMatch[1].trim()}`;
    } else {
      const luiMatch = desc.match(/Ngày lùi(?: linh động| tối đa)?\s*[:•~]\s*([^\n\r•]+)/i);
      if (luiMatch) {
        moveInStatus = `Lùi ${luiMatch[1].trim().replace(/^~+\s*/, '')}`;
      }
    }
  }
  data.moveInNote = moveInStatus;

  // 5. Total floors & Floor string
  const totalFloorMatch = desc.match(/Tổng số tầng(?:\s*nhà)?[:\s]*(\d+)/i);
  const totalFloors = totalFloorMatch ? parseInt(totalFloorMatch[1], 10) : 6;
  const currentFloorMatch = desc.match(/Tầng\s*(\d+)/i);
  const currentFloor = currentFloorMatch ? currentFloorMatch[1] : (availableFloors.length > 0 ? availableFloors[0].replace(/\D/g, '') : '2');
  
  // 6. Elevator
  let hasElevator = true;
  if (chips.some(c => c.toLowerCase().includes('thang máy'))) {
    hasElevator = true;
  } else if (chips.some(c => c.toLowerCase().includes('thang bộ'))) {
    hasElevator = false;
  } else {
    const elMatch = desc.match(/(?:Thang máy|Thang)\s*[:•]\s*([^\n\r•]+)/i);
    if (elMatch) {
      const elVal = elMatch[1].toLowerCase();
      if (elVal.includes('bộ') || elVal.includes('ko') || elVal.includes('không')) hasElevator = false;
      else if (elVal.includes('có') || elVal.includes('thang máy')) hasElevator = true;
    }
  }
  data.elevator = hasElevator;
  data.floor = `Tầng ${currentFloor} / ${totalFloors} tầng (${hasElevator ? 'Thang máy Có' : 'Thang bộ'})`;

  // 7. Layout & Category Detection (Chuẩn Khép kín / Studio / 1N1K / 2N1K / 3N1K / Nguyên căn)
  const isNguyenCan = chips.some(c => c.toLowerCase().includes('nguyên căn')) || fullText.includes('nguyên căn');
  data.isNguyenCan = isNguyenCan;

  if (isNguyenCan) {
    data.roomLayout = 'Nguyên căn';
  } else {
    const layoutChip = chips.find(c => ['STUDIO', '1N1K', '2N1K', '3N1K', 'DUPLEX', 'GÁC XÉP', 'GÁC LỬNG'].includes(c.toUpperCase()));
    if (layoutChip) {
      const u = layoutChip.toUpperCase();
      if (u === 'DUPLEX' || u === 'GÁC XÉP' || u === 'GÁC LỬNG') data.roomLayout = 'Gác lửng';
      else data.roomLayout = u;
    } else if (fullText.includes('3n1k') || fullText.includes('3 ngủ 1 khách') || fullText.includes('3 phòng ngủ')) {
      data.roomLayout = '3N1K';
    } else if (fullText.includes('2n1k') || fullText.includes('2 ngủ 1 khách') || fullText.includes('2 phòng ngủ')) {
      data.roomLayout = '2N1K';
    } else if (fullText.includes('1n1k') || fullText.includes('1 ngủ 1 khách') || fullText.includes('1 phòng ngủ')) {
      data.roomLayout = '1N1K';
    } else if (fullText.includes('duplex') || fullText.includes('gác xép') || fullText.includes('gác lửng') || fullText.includes('có gác')) {
      data.roomLayout = 'Gác lửng';
    } else {
      data.roomLayout = 'STUDIO';
    }
  }

  // 8. Furniture
  let furnishLevel = 'Full đồ';
  if (chips.some(c => c.toLowerCase().includes('full đồ') || c.toLowerCase().includes('full nội thất'))) {
    furnishLevel = 'Full đồ';
  } else if (chips.some(c => c.toLowerCase().includes('cơ bản') || c.toLowerCase().includes('đồ cơ bản'))) {
    furnishLevel = 'Cơ bản';
  } else if (fullText.includes('cơ bản')) {
    furnishLevel = 'Cơ bản';
  }
  data.furnishLevel = furnishLevel;

  const furnMatch = desc.match(/(?:Nội thất|nội thất)\s*[:•]\s*([^\n\r•]+)/i);
  data.furniture = furnMatch ? furnMatch[1].trim() : '';

  // 9. Service fees
  const dienMatch = desc.match(/(?:Điện|dien)\s*[:•]\s*([^\n\r•]+)/i);
  data.feeElectricity = dienMatch ? dienMatch[1].trim() : '4k/số';

  const nuocMatch = desc.match(/(?:Nước|nuoc)\s*[:•]\s*([^\n\r•]+)/i);
  data.feeWater = nuocMatch ? nuocMatch[1].trim() : '35k/khối';

  const mangMatch = desc.match(/(?:WIFI|Mạng|Wifi|Internet)\s*[:•]\s*([^\n\r•]+)/i);
  data.feeInternet = mangMatch ? mangMatch[1].trim() : '100k/phòng';

  const dvChungMatch = desc.match(/(?:Dịch vụ chung|Dịch vụ)\s*[:•]\s*([^\n\r•]+)/i);
  data.feeService = dvChungMatch ? dvChungMatch[1].trim() : '200k/người';

  const thangMayFeeMatch = desc.match(/Thang máy\s*[:•]\s*(\d+k\/người[^\n\r•]*)/i);
  data.feeElevator = thangMayFeeMatch ? thangMayFeeMatch[1].trim() : '';

  const xeMayMatch = desc.match(/(?:Xe máy|xe máy)\s*[:•]\s*([^\n\r•]+)/i);
  data.feeParking = xeMayMatch ? xeMayMatch[1].trim() : 'Free 2 xe';

  // 10. Pet Policy (Nuôi pet)
  let petAllowed = false;
  if (allChipsText.includes('Không nuôi pet') || allChipsText.includes('Cấm pet')) {
    petAllowed = false;
  } else if (allChipsText.includes('Nhận pet') || allChipsText.includes('Cho nuôi pet')) {
    petAllowed = true;
  } else {
    const petMatch = desc.match(/(?:Nuôi pet|Pet|Thú cưng)\s*[:•]\s*([^\n\r•]+)/i);
    if (petMatch) {
      const pVal = petMatch[1].toLowerCase();
      if (pVal.includes('ko') || pVal.includes('không') || pVal.includes('cấm') || pVal.includes('k ')) petAllowed = false;
      else if (pVal.includes('có') || pVal.includes('được') || pVal.includes('cho') || pVal.includes('nhận') || pVal.includes('cam kết') || pVal.includes('ok')) petAllowed = true;
    } else {
      petAllowed = fullText.includes('nuôi pet: có') || fullText.includes('cho nuôi pet') || fullText.includes('pet: có');
    }
  }
  data.petAllowed = petAllowed;

  // 11. Electric Vehicle Policy (Xe điện)
  let evPolicy = 'unspecified';
  let evNote = 'Liên hệ chủ nhà';
  let electricVehicle = false;

  if (allChipsText.includes('Cấm xe điện') || allChipsText.includes('Không nhận xe điện')) {
    evPolicy = 'forbidden';
    evNote = 'Không nhận xe điện';
    electricVehicle = false;
  } else if (allChipsText.includes('VinFast') || allChipsText.includes('pin rời') || allChipsText.includes('đổi pin')) {
    evPolicy = 'vinfast_only';
    evNote = 'Chỉ nhận xe VinFast pin rời';
    electricVehicle = true;
  } else if (allChipsText.includes('Nhận xe điện')) {
    evPolicy = 'allowed';
    evNote = 'Nhận xe điện';
    electricVehicle = true;
  } else {
    const evMatch = desc.match(/(?:XE|Xe)\s*điện\s*[:•]\s*([^\n\r•]+)/i);
    if (evMatch) {
      const evVal = evMatch[1].toLowerCase();
      if (evVal.includes('ko') || evVal.includes('không') || evVal.includes('cấm') || evVal.includes('k ')) {
        evPolicy = 'forbidden'; evNote = 'Không nhận xe điện'; electricVehicle = false;
      } else if (evVal.includes('vinfast') || evVal.includes('pin rời') || evVal.includes('đổi pin')) {
        evPolicy = 'vinfast_only'; evNote = 'Chỉ nhận xe VinFast pin rời'; electricVehicle = true;
      } else if (evVal.includes('có') || evVal.includes('nhận') || evVal.includes('được')) {
        evPolicy = 'allowed'; evNote = 'Nhận xe điện'; electricVehicle = true;
      }
    }
  }
  data.evPolicy = evPolicy;
  data.evNote = evNote;
  data.electricVehicle = electricVehicle;

  // 12. Foreign Guest (Khách nước ngoài / Khách quốc tế)
  let foreignGuest = false;
  if (allChipsText.includes('Không khách quốc tế') || allChipsText.includes('Không khách nước ngoài')) {
    foreignGuest = false;
  } else if (allChipsText.includes('Nhận khách quốc tế') || allChipsText.includes('Nhận khách nước ngoài')) {
    foreignGuest = true;
  } else {
    const fgMatch = desc.match(/(?:Khách\s*(?:nước\s*ngoài|quốc\s*tế|tây)|Nước\s*ngoài)\s*[:•]\s*([^\n\r•]+)/i);
    if (fgMatch) {
      const fgVal = fgMatch[1].toLowerCase();
      if (fgVal.includes('ko') || fgVal.includes('không') || fgVal.includes('cấm') || fgVal.includes('k ')) foreignGuest = false;
      else if (fgVal.includes('có') || fgVal.includes('nhận') || fgVal.includes('được')) foreignGuest = true;
    }
  }
  data.foreignGuest = foreignGuest;

  // 13. Environment & Location
  data.nearParking = allChipsText.includes('bãi đỗ ô tô') || allChipsText.includes('Ô tô vào nhà') || allChipsText.includes('Ô tô đỗ cửa') || fullText.includes('ô tô') || fullText.includes('bãi đỗ') || fullText.includes('bãi ô tô');
  data.nearMainRoad = allChipsText.includes('đường lớn') || allChipsText.includes('Mặt đường') || fullText.includes('đường lớn') || fullText.includes('mặt đường') || fullText.includes('ô tô đỗ') || fullText.includes('ngõ thoáng');
  data.hasLoft = data.roomLayout === 'Gác lửng' || fullText.includes('gác xép') || fullText.includes('duplex');
  data.fireSafety = fullText.includes('pccc') || fullText.includes('thang thoát hiểm');

  // 14. Terms
  const hopDongMatch = desc.match(/Hợp đồng\s*[:•]\s*([^\n\r•]+)/i);
  data.contractTerm = hopDongMatch ? hopDongMatch[1].trim() : '12 tháng';

  const thanhToanMatch = desc.match(/Thanh toán\s*[:•]\s*([^\n\r•]+)/i);
  data.depositTerm = thanhToanMatch ? thanhToanMatch[1].trim() : 'Cọc 1 đóng 1';

  return data;
}

// ======================================================================
// PARSE FULL DETAIL DESCRIPTION INTO 4 SECTIONS (100% COMPLETE & CLEAN)
// ======================================================================
function parseDetailDescription(data) {
  const desc = data.description || '';
  const sections = { info: '', amenity: '', service: '', note: '' };

  const infoMatch = desc.match(/(?:THÔNG TIN PHÒNG(?:_[A-Z0-9]+)?|📋\s*THÔNG TIN|ĐỊA CHỈ\s*:)/i);
  const amenityMatch = desc.match(/(?:✅\s*TIỆN ÍCH|TIỆN ÍCH\b)/i);
  const serviceMatch = desc.match(/(?:(?:🚚|🏆)\s*DỊCH VỤ|DỊCH VỤ\b)/i);
  const noteMatch = desc.match(/(?:❎\s*LƯU Ý|LƯU Ý\b)/i);

  const infoIdx = infoMatch ? infoMatch.index : -1;
  const amenityIdx = amenityMatch ? amenityMatch.index : -1;
  const serviceIdx = serviceMatch ? serviceMatch.index : -1;
  const noteIdx = noteMatch ? noteMatch.index : -1;

  if (infoIdx > -1) {
    const end = (amenityIdx > infoIdx) ? amenityIdx : ((serviceIdx > infoIdx) ? serviceIdx : ((noteIdx > infoIdx) ? noteIdx : desc.length));
    sections.info = desc.substring(infoIdx, end).trim();
  }
  if (amenityIdx > -1) {
    const end = (serviceIdx > amenityIdx) ? serviceIdx : ((noteIdx > amenityIdx) ? noteIdx : desc.length);
    sections.amenity = desc.substring(amenityIdx, end).trim();
  }
  if (serviceIdx > -1) {
    const end = (noteIdx > serviceIdx) ? noteIdx : desc.length;
    sections.service = desc.substring(serviceIdx, end).trim();
  }
  if (noteIdx > -1) {
    sections.note = desc.substring(noteIdx).trim();
  }

  // Làm sạch tiêu đề thừa đầu mỗi khối
  if (sections.info) sections.info = sections.info.replace(/^(?:📋\s*)?THÔNG TIN PHÒNG(?:_[A-Z0-9]+)?\s*:?\s*/i, '').trim();
  if (sections.amenity) sections.amenity = sections.amenity.replace(/^(?:✅\s*)?TIỆN ÍCH\s*:?\s*/i, '').trim();
  if (sections.service) sections.service = sections.service.replace(/^(?:(?:🚚|🏆)\s*)?DỊCH VỤ\s*:?\s*/i, '').trim();
  if (sections.note) sections.note = sections.note.replace(/^(?:❎\s*)?LƯU Ý\s*:?\s*/i, '').trim();

  // Robust Fallbacks
  if (!sections.info && data.address) sections.info = `ĐỊA CHỈ: ${data.address}\nDiện tích: ${data.area || 25}m2\nDạng phòng: ${data.roomLayout || 'Studio'}`;
  if (!sections.amenity && data.furniture) sections.amenity = `• Nội thất: ${data.furniture}`;
  if (!sections.service && data.feeElectricity) sections.service = `• Điện: ${data.feeElectricity}\n• Nước: ${data.feeWater}\n• Mạng: ${data.feeInternet}\n• Dịch vụ chung: ${data.feeService}`;
  if (!sections.note && data.contractTerm) sections.note = `• Hợp đồng: ${data.contractTerm}\n• Thanh toán: ${data.depositTerm}\n• Tối đa: ${data.maxPeople} người ${data.maxVehicles} xe`;

  return sections;
}

// ======================================================================
// CONVERT TO ROOM FORMAT
// ======================================================================
function convertToRoomFormat(data, sourceGroup, district) {
  let price = 0;
  if (data.priceStr) price = parseInt(data.priceStr.replace(/[.,]/g, ''), 10) || 0;

  const SOURCE_GROUP_NAMES = {
    'nguon-hoai-duc': 'Hoài Đức', 'nguon-cau-giay': 'Cầu Giấy',
    'nguon-hoang-mai': 'Hoàng Mai', 'nguon-my-dinh': 'Mỹ Đình',
    'nguon-nam-tu-liem': 'Nam Từ Liêm', 'nguon-xuan-dinh': 'Cổ Nhuế, Xuân Đỉnh',
    'nguon-thanh-xuan': 'Thanh Xuân', 'nguon-ba-dinh': 'Ba Đình - Tây Hồ',
    'nguon-tay-ho': 'Tây Hồ', 'nguon-dong-da': 'Đống Đa',
    'nguon-cau-dien': 'Cầu Diễn', 'nguon-kim-giang-ngoc-hoi': 'Kim Giang, Ngọc Hồi',
    'nguon-trieu-khuc': 'Triều Khúc', 'nguon-phu-dien': 'Phú Diễn',
    'nguon-xuan-phuong': 'Xuân Phương', 'nguon-yen-xa-mau-luong': 'Yên Xá/Mậu Lương',
    'ngoc-truc-dai-linh': 'Ngọc Trục - Đại Linh', 'nguon-ha-dong': 'Hà Đông'
  };

  const evPolicy = data.evPolicy || 'unspecified';
  const evAllowed = evPolicy === 'allowed' || evPolicy === 'vinfast_only';
  const evNote = data.evNote || 'Liên hệ chủ nhà';

  const isNguyenCan = data.isNguyenCan || data.roomLayout === 'Nguyên căn';

  let categoryName = 'Khép kín';
  let tag = 'Khép kín';
  if (isNguyenCan) {
    categoryName = 'Nguyên căn';
    tag = 'Nguyên căn';
  } else {
    categoryName = data.roomLayout !== 'STUDIO' ? `Khép kín (${data.roomLayout})` : 'Khép kín';
    tag = 'Khép kín';
  }

  return {
    id: 'MT-' + data.slug.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-'),
    title: transformMoithueName(data.title || data.slug),
    address: transformMoithueName(data.address || ''),
    district: district || 'cau-giay',
    sourceGroup: sourceGroup || 'nguon-cau-giay',
    sourceGroupName: SOURCE_GROUP_NAMES[sourceGroup] || sourceGroup,
    roomLayout: data.roomLayout || 'STUDIO',
    categoryName,
    tag,
    status: 'available',
    statusName: 'Còn phòng',
    price,
    area: data.area || 25,
    floor: data.floor || 'Tầng 3 / 6 tầng',
    maxPeople: data.maxPeople || 2,
    elevator: data.elevator !== false,
    furnishLevel: data.furnishLevel || 'Full đồ',
    maxVehicles: data.maxVehicles || 2,
    petAllowed: data.petAllowed || false,
    electricVehicle: evAllowed,
    electricVehiclePolicy: evPolicy,
    electricVehicleNote: evNote,
    foreignGuest: data.foreignGuest || false,
    nearParking: data.nearParking !== false,
    nearMainRoad: data.nearMainRoad !== false,
    loft: data.hasLoft || false,
    fireSafety: data.fireSafety || false,
    availableFloors: data.availableFloors || [],
    videoUrl: data.videoUrl || '',
    videoDriveUrl: data.videoDriveUrl || '',
    feeElectricity: data.feeElectricity || '4k/số',
    feeWater: data.feeWater || '30k/khối',
    feeInternet: data.feeInternet || '100k/phòng',
    feeService: data.feeService || '150k/người',
    feeElevator: data.feeElevator || '',
    feeParking: data.feeParking || 'Free 2 xe',
    contractTerm: data.contractTerm || '12 tháng',
    depositTerm: data.depositTerm || 'Cọc 1 đóng 1',
    images: data.images.length > 0 ? data.images : ['https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80'],
    amenities: data.amenities || ['Điều hòa', 'Nóng lạnh', 'Giường', 'Tủ quần áo'],
    description: data.description || `${data.title} tại ${data.address}.`,
    detailDescription: parseDetailDescription(data),
    moveInStatus: data.moveInNote || 'Ở ngay',
    featured: false,
    views: 1,
    moithueUrl: data.url,
    moithueSlug: data.slug,
    createdAt: new Date().toISOString()
  };
}

// ======================================================================
// API: FETCH LISTING
// ======================================================================
async function fetchListing(listingUrl, sourceGroup, district) {
  const slugMatch = listingUrl.match(/\/listing\/([^/]+)\/?$/);
  if (!slugMatch) throw new Error('Invalid URL. Must be moithue.com/listing/slug/');
  const slug = slugMatch[1];

  await login();

  const res = await httpGet(`https://moithue.com/listing/${slug}/`);
  if (res.status !== 200) throw new Error(`HTTP ${res.status}`);

  const extracted = extractRoomFromHtml(res.body, slug);
  const room = convertToRoomFormat(extracted, sourceGroup, district);
  return room;
}

// ======================================================================
// STATIC FILE SERVER
// ======================================================================
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff'
};

const zlib = require('zlib');
const fileCache = new Map();

function serveStaticFile(filePath, req, res) {
  const fullPath = path.join(__dirname, filePath);
  if (!fs.existsSync(fullPath)) {
    res.writeHead(404); res.end('Not found'); return;
  }
  const ext = path.extname(fullPath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  let content;
  try {
    content = fs.readFileSync(fullPath);
  } catch (e) {
    res.writeHead(500); res.end('Read error'); return;
  }

  const acceptEncoding = (req && req.headers && req.headers['accept-encoding']) || '';
  const isMediaOrFont = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.ico', '.woff2', '.woff'].includes(ext);
  const headers = {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': isMediaOrFont ? 'public, max-age=604800, immutable' : 'no-cache, no-store, must-revalidate'
  };

  const compressible = ['.html', '.css', '.js', '.json', '.svg'].includes(ext);
  if (compressible && acceptEncoding.includes('gzip')) {
    headers['Content-Encoding'] = 'gzip';
    res.writeHead(200, headers);
    zlib.gzip(content, (err, gzipped) => {
      if (err) { res.end(content); } else { res.end(gzipped); }
    });
  } else {
    res.writeHead(200, headers);
    res.end(content);
  }
}

// ======================================================================
// MAIN SERVER
// ======================================================================
const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = parsedUrl.pathname;

  // API: Get rooms from rooms_new.json
  if (pathname === '/api/rooms' && req.method === 'GET') {
    try {
      const roomsPath = path.join(__dirname, 'rooms_new.json');
      if (fs.existsSync(roomsPath)) {
        const data = fs.readFileSync(roomsPath, 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(data);
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify([]));
      }
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // API: Save rooms to rooms_new.json
  if ((pathname === '/api/save-rooms' || pathname === '/api/rooms') && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const roomsData = JSON.parse(body);
        if (!Array.isArray(roomsData)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Expected array of rooms' }));
          return;
        }
        const roomsPath = path.join(__dirname, 'rooms_new.json');
        fs.writeFileSync(roomsPath, JSON.stringify(roomsData, null, 2), 'utf8');
        console.log(`💾 Persisted ${roomsData.length} rooms to rooms_new.json`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, count: roomsData.length }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // API: Fetch listing
  if (pathname === '/api/fetch-listing' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { url, sourceGroup, district } = JSON.parse(body);
        if (!url) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Missing url' })); return; }

        console.log(`📥 Fetching: ${url}`);
        const room = await fetchListing(url, sourceGroup, district);
        console.log(`✅ Fetched 100%: ${room.title}`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, room }));
      } catch (err) {
        console.error('❌ Error:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Chặn hoàn toàn đường dẫn admin cũ
  if (pathname === '/admin' || pathname === '/admin.html') {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>404 Not Found</h1><p>Trang không tồn tại.</p>');
    return;
  }

  // Đường dẫn quản trị bí mật
  if (pathname === '/minhthu2812' || pathname === '/minhthu2812.html') {
    serveStaticFile('/minhthu2812.html', req, res);
    return;
  }

  // Static files
  let filePath = pathname === '/' ? '/index.html' : pathname;
  filePath = filePath.replace(/\.\./g, ''); // Security: prevent path traversal
  serveStaticFile(filePath, req, res);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Cổng ${PORT} đang bị chiếm dụng. Vui lòng đóng ứng dụng cũ hoặc thử lại sau.`);
  } else {
    console.error('❌ Server error:', err.message);
  }
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err.message);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection:', reason);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  🚀 SERVER QUẢN TRỊ ĐÃ KHỞI ĐỘNG             ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  🌐 http://localhost:${PORT}/admin.html              ║`);
  console.log(`║  🌐 http://localhost:${PORT}/index.html              ║`);
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');
  console.log('📌 Mở trình duyệt và truy cập link trên');
  console.log('📌 Nhấn Ctrl+C để tắt server');
  console.log('');
});
