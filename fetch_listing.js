#!/usr/bin/env node
// ==========================================================================
// FETCH SINGLE MOITHUE.COM LISTING
// Usage: node fetch_listing.js <moithue-listing-url>
// Output: fetched_listing.json (ready to import into admin panel)
// ==========================================================================

const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const CREDENTIALS = { email: 'Phonghuyentran.moithue@gmail.com', password: 'Huyentran' };
let cookies = {};

// Source group mapping
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
  'hinode': 'hoai-duc', 'di trạch': 'hoai-duc', 'vân canh': 'hoai-duc',
  'cầu giấy': 'cau-giay', 'dịch vọng': 'cau-giay', 'trung hoà': 'cau-giay',
  'hoàng mai': 'hoang-mai', 'định công': 'hoang-mai', 'lĩnh nam': 'hoang-mai',
  'vĩnh hưng': 'hoang-mai', 'tân mai': 'hoang-mai', 'thanh trì': 'hoang-mai',
  'mỹ đình': 'nam-tu-liem', 'nam từ liêm': 'nam-tu-liem', 'mễ trì': 'nam-tu-liem',
  'phú đô': 'nam-tu-liem', 'cầu diễn': 'nam-tu-liem',
  'bắc từ liêm': 'bac-tu-liem', 'xuân đỉnh': 'bac-tu-liem', 'cổ nhuế': 'bac-tu-liem',
  'thanh xuân': 'thanh-xuan', 'kim giang': 'thanh-xuan',
  'ba đình': 'ba-dinh', 'tây hồ': 'tay-ho', 'đống đa': 'dong-da',
  'hà đông': 'ha-dong', 'ngọc trục': 'ha-dong', 'đại linh': 'ha-dong',
  'triều khúc': 'ha-dong', 'xuân phương': 'bac-tu-liem',
  'yên xá': 'ha-dong', 'mậu lương': 'ha-dong'
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
  'ngoc-truc-dai-linh': 'Ngọc Trục - Đại Linh', 'nguon-ha-dong': 'Hà Đông'
};

// ======================================================================
// HTTP HELPERS
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
async function login(force = false) {
  if (!force && Object.keys(cookies).some(k => k.startsWith('wordpress_logged_in_'))) return true;
  cookies = {};
  console.log('🔑 Logging into moithue.com...');
  await httpGet('https://moithue.com/wp-login.php');
  await httpPost('https://moithue.com/wp-login.php', {
    log: CREDENTIALS.email,
    pwd: CREDENTIALS.password,
    'wp-submit': 'Đăng nhập',
    redirect_to: 'https://moithue.com/',
    testcookie: '1'
  });
  const loggedIn = Object.keys(cookies).some(k => k.startsWith('wordpress_logged_in_'));
  if (loggedIn) console.log('✅ Login successful!');
  else console.log('⚠️ Login failed. Continuing without auth...');
  return loggedIn;
}

// ======================================================================
// EXTRACT ROOM DATA FROM SINGLE LISTING PAGE (100% FULL PARSER)
// ======================================================================
function cleanHtmlPreserveBreaks(html) {
  if (!html) return '';
  return html
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
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
    .replace(/&hellip;/g, '...')
    .replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();
}

function transformMoithueName(str) {
  if (!str) return '';
  // Chuyển 115.x -> 115, 115.55.x -> 115, 58.05 -> 58, 89.19.38.x -> 89
  return str.replace(/^((?:[A-Za-z]{1,4}\s*)?\d+[A-Za-z]?)(?:\.[a-zA-Z0-9]+)+\s+/i, (match, prefix) => prefix + ' ').trim();
}

function extractRoomFromHtml(html, slug) {
  const data = { slug, url: `https://moithue.com/listing/${slug}/` };

  // 1. Title (Chuyển dạng "58.05 Phú Vinh..." -> "ngõ 58 Phú Vinh...")
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const titleTagMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const rawTitle = h1Match ? h1Match[1] : (titleTagMatch ? titleTagMatch[1] : slug);
  const cleanedTitle = cleanHtmlPreserveBreaks(rawTitle).replace(/ - Mời Thuê.*$/, '').replace(/ – Mời Thuê.*$/, '').trim();
  data.title = transformMoithueName(cleanedTitle);

  // 2. Price (From main listing price widget)
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

  // 4. Extract "Trong nhà có gì?" (100% Features / Amenities)
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

  // 5. Extract "Tầng còn phòng ở trục này" (Available floors / room numbers P.204, P.304, etc.)
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
    // Fallback if no listivo-tag divs found
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

  // 6. Extract Video (YouTube embed and Google Drive video link)
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

  // 7. Extract 100% Gallery Images (Permanent URLs, zero cutoff)
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
    if (maxVehMatch) maxVehicles = parseInt(maxVehicles[1], 10);
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
  return data;
}

// ======================================================================
// PARSE FULL DETAIL DESCRIPTION INTO 4 SECTIONS (100% COMPLETE)
// ======================================================================
function parseDetailDescription(data) {
  const desc = data.description || '';
  const sections = { info: '', amenity: '', service: '', note: '' };

  const splitRegex = /(?=(?:THÔNG TIN PHÒNG|📋\s*THÔNG TIN|✅\s*TIỆN ÍCH|TIỆN ÍCH\b|(?:🚚|🏆)\s*DỊCH VỤ|DỊCH VỤ\s*:|❎\s*LƯU Ý|LƯU Ý\s*:))/i;
  const parts = desc.split(splitRegex);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    if (/^(?:THÔNG TIN PHÒNG|📋\s*THÔNG TIN|ĐỊA CHỈ)/i.test(trimmed)) {
      sections.info = trimmed;
    } else if (/^(?:✅\s*TIỆN ÍCH|TIỆN ÍCH)/i.test(trimmed)) {
      sections.amenity = trimmed;
    } else if (/^(?:(?:🚚|🏆)\s*DỊCH VỤ|DỊCH VỤ\s*:)/i.test(trimmed)) {
      sections.service = trimmed;
    } else if (/^(?:❎\s*LƯU Ý|LƯU Ý\s*:)/i.test(trimmed)) {
      sections.note = trimmed;
    } else if (!sections.info) {
      sections.info = trimmed;
    }
  }

  // Robust Fallbacks
  if (!sections.info && data.address) sections.info = `ĐỊA CHỈ: ${data.address}\nDiện tích: ${data.area || 25}m2\nDạng phòng: ${data.roomLayout || 'Studio'}`;
  if (!sections.amenity && data.furniture) sections.amenity = `✅ TIỆN ÍCH\n• Nội thất: ${data.furniture}`;
  if (!sections.service && data.feeElectricity) sections.service = `🚚 DỊCH VỤ\n• Điện: ${data.feeElectricity}\n• Nước: ${data.feeWater}\n• Mạng: ${data.feeInternet}\n• Dịch vụ chung: ${data.feeService}`;
  if (!sections.note && data.contractTerm) sections.note = `❎ LƯU Ý\n• Hợp đồng: ${data.contractTerm}\n• Thanh toán: ${data.depositTerm}\n• Tối đa: ${data.maxPeople} người ${data.maxVehicles} xe`;

  return sections;
}

// ======================================================================
// CONVERT TO ROOM FORMAT
// ======================================================================
function convertToRoomFormat(data) {
  let price = 0;
  if (data.priceStr) {
    price = parseInt(data.priceStr.replace(/[.,]/g, ''), 10) || 0;
  }
  const area = data.area || 25;
  const sourceGroup = guessSourceGroup(data.address, data.title);
  const district = guessDistrict(data.address);

  const evPolicy = data.evPolicy || 'unspecified';
  const evAllowed = evPolicy === 'allowed' || evPolicy === 'vinfast_only';
  const evNote = data.evNote || 'Liên hệ chủ nhà';

  const fullDescLow = ((data.title || '') + ' ' + (data.description || '') + ' ' + (data.roomLayout || '')).toLowerCase();
  const isVsChung = data.isVsChung || fullDescLow.includes('vsinh chung') || fullDescLow.includes('vệ sinh chung') || fullDescLow.includes('vs chung') || fullDescLow.includes('wc chung') || fullDescLow.includes('không khép kín') || fullDescLow.includes('vệ sinh ngoài') || fullDescLow.includes('chung vệ sinh') || fullDescLow.includes('vsinh: chung');
  const isNguyenCan = data.isNguyenCan || data.roomLayout === 'Nguyên căn' || fullDescLow.includes('nguyên căn');

  let categoryName = 'Khép kín';
  let tag = 'Khép kín';
  if (isVsChung) {
    categoryName = 'VS chung';
    tag = 'VS chung';
  } else if (isNguyenCan) {
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
    district,
    sourceGroup,
    sourceGroupName: SOURCE_GROUP_NAMES[sourceGroup] || sourceGroup,
    roomLayout: data.roomLayout || 'STUDIO',
    categoryName,
    tag,
    status: 'available',
    statusName: 'Còn phòng',
    price,
    area,
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
    images: data.images.length > 0 ? data.images : [
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80'
    ],
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

function guessSourceGroup(address, title) {
  const combined = ((address || '') + ' ' + (title || '')).toLowerCase();
  for (const [keyword, groupId] of Object.entries(SOURCE_GROUP_MAP)) {
    if (combined.includes(keyword)) return groupId;
  }
  return 'nguon-cau-giay';
}

function guessDistrict(address) {
  const addr = (address || '').toLowerCase();
  for (const [keyword, districtId] of Object.entries(DISTRICT_MAP)) {
    if (addr.includes(keyword)) return districtId;
  }
  return 'cau-giay';
}

// ======================================================================
// MAIN
// ======================================================================
async function main() {
  const listingUrl = process.argv[2];
  if (!listingUrl) {
    console.log('');
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║  FETCH SINGLE MOITHUE.COM LISTING              ║');
    console.log('╚══════════════════════════════════════════════════╝');
    console.log('');
    console.log('Usage:');
    console.log('  node fetch_listing.js <moithue-listing-url>');
    console.log('');
    console.log('Example:');
    console.log('  node fetch_listing.js https://moithue.com/listing/58-05-phu-vinh_203204_a-huy_ak/');
    console.log('');
    console.log('Output: fetched_listing.json');
    console.log('Then import it in Admin → Sync → Import fetched_listing.json');
    console.log('');
    process.exit(0);
  }

  // Extract slug from URL
  const slugMatch = listingUrl.match(/\/listing\/([^/]+)\/?$/);
  if (!slugMatch) {
    console.error('❌ Invalid URL. Must be a moithue.com listing URL');
    console.error('   Example: https://moithue.com/listing/slug-name/');
    process.exit(1);
  }
  const slug = slugMatch[1];

  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  FETCHING MOITHUE.COM LISTING                  ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');
  console.log(`📋 Slug: ${slug}`);
  console.log(`🔗 URL: https://moithue.com/listing/${slug}/`);
  console.log('');

  try {
    // Login
    await login();

    // Fetch listing page
    console.log('📥 Fetching listing page...');
    const res = await httpGet(`https://moithue.com/listing/${slug}/`);

    if (res.status !== 200) {
      console.error(`❌ Failed to fetch listing: HTTP ${res.status}`);
      process.exit(1);
    }

    console.log(`✅ Page fetched (${Math.round(res.body.length / 1024)}KB)`);

    // Extract data
    console.log('🔍 Extracting room data...');
    const extracted = extractRoomFromHtml(res.body, slug);

    // Convert to room format
    const room = convertToRoomFormat(extracted);

    // Save to file
    const outputFile = path.join(__dirname, 'fetched_listing.json');
    fs.writeFileSync(outputFile, JSON.stringify(room, null, 2), 'utf-8');

    console.log('');
    console.log('══════════════════════════════════════════════════');
    console.log('📊 ROOM DATA EXTRACTED:');
    console.log('══════════════════════════════════════════════════');
    console.log(`  📝 Title:     ${room.title}`);
    console.log(`  📍 Address:   ${room.address}`);
    console.log(`  🏘️ District:  ${room.district}`);
    console.log(`  🧭 Source:    ${room.sourceGroupName}`);
    console.log(`  💰 Price:     ${new Intl.NumberFormat('vi-VN').format(room.price)}đ/tháng`);
    console.log(`  📐 Area:      ${room.area}m²`);
    console.log(`  🏠 Layout:    ${room.roomLayout}`);
    console.log(`  🖼️ Images:    ${room.images.length}`);
    console.log(`  ⚡ EV Policy: ${room.electricVehiclePolicy}`);
    console.log(`  🐾 Pet:       ${room.petAllowed ? 'Có' : 'Không'}`);
    console.log('══════════════════════════════════════════════════');
    console.log('');
    console.log(`💾 Saved to: ${outputFile}`);
    console.log('');
    console.log('📌 Next steps:');
    console.log('   1. Open admin.html → Sync tab');
    console.log('   2. Click "Import fetched_listing.json"');
    console.log('   3. Room will be added/updated in the system');
    console.log('');
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  fetchListing: async (listingUrl, sourceGroup, district) => {
    const slugMatch = listingUrl.match(/\/listing\/([^/]+)\/?$/);
    if (!slugMatch) throw new Error('Invalid URL. Must be moithue.com/listing/slug/');
    const slug = slugMatch[1];
    await login();
    let res = await httpGet(`https://moithue.com/listing/${slug}/`);
    if (res.status === 403 || res.status === 401 || res.status === 503) {
      await new Promise(r => setTimeout(r, 1500));
      await login(true);
      res = await httpGet(`https://moithue.com/listing/${slug}/`);
    }
    if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
    const extracted = extractRoomFromHtml(res.body, slug);
    const room = convertToRoomFormat(extracted);
    if (sourceGroup) {
      room.sourceGroup = sourceGroup;
      room.sourceGroupName = SOURCE_GROUP_NAMES[sourceGroup] || sourceGroup;
    }
    if (district) {
      room.district = district;
    }
    return room;
  },
  extractRoomFromHtml,
  convertToRoomFormat
};
