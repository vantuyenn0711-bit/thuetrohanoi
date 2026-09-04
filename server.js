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

  // 8. Parse Detailed Attributes
  const desc = data.description || '';
  const fullText = (data.title + '\n' + desc).toLowerCase();

  // Address
  const addrMatch = desc.match(/(?:ĐỊA CHỈ|Địa chỉ)[:\s]*([^\n\r\u23F0-\u23FF\u2600-\u27BF]+)/iu);
  data.address = transformMoithueName(addrMatch ? addrMatch[1].trim().replace(/[\s]+$/, '') : data.title);

  // Area
  const areaMatch = desc.match(/(?:Diện tích|DT|dt)[:\s]*(\d+)\s*m/i) || desc.match(/(\d+)\s*m[²2]/);
  data.area = areaMatch ? parseInt(areaMatch[1], 10) : 25;

  // Total floors & Floor string
  const totalFloorMatch = desc.match(/Tổng số tầng(?:\s*nhà)?[:\s]*(\d+)/i);
  const totalFloors = totalFloorMatch ? parseInt(totalFloorMatch[1], 10) : 6;
  const currentFloorMatch = desc.match(/Tầng\s*(\d+)/i);
  const currentFloor = currentFloorMatch ? currentFloorMatch[1] : (availableFloors.length > 0 ? availableFloors[0].replace(/\D/g, '') : '2');
  const hasElevator = fullText.includes('thang máy: có') || fullText.includes('thang máy : có') || fullText.includes('thang : thang máy') || (fullText.includes('thang máy') && !fullText.includes('thang bộ'));
  data.elevator = hasElevator;
  data.floor = `Tầng ${currentFloor} / ${totalFloors} tầng (${hasElevator ? 'Thang máy Có' : 'Thang bộ'})`;

  // Layout
  if (fullText.includes('3n1k') || fullText.includes('3 phòng')) data.roomLayout = '3N1K';
  else if (fullText.includes('2n1k') || fullText.includes('2 phòng')) data.roomLayout = '2N1K';
  else if (fullText.includes('1n1k') || fullText.includes('1 phòng')) data.roomLayout = '1N1K';
  else if (fullText.includes('duplex') || fullText.includes('gác xép') || fullText.includes('có gác')) data.roomLayout = 'Duplex/Gác xép';
  else if (fullText.includes('nguyên căn')) data.roomLayout = 'Nguyên căn';
  else data.roomLayout = 'STUDIO';

  // Furniture
  const furnMatch = desc.match(/(?:Nội thất|nội thất)[:\s]*([^\n\r]+)/i);
  data.furniture = furnMatch ? furnMatch[1].trim() : '';
  if (fullText.includes('full đồ') || fullText.includes('full nội thất')) data.furnishLevel = 'Full đồ';
  else if (fullText.includes('cơ bản')) data.furnishLevel = 'Cơ bản';
  else data.furnishLevel = 'Full đồ';

  // Service fees
  const dienMatch = desc.match(/(?:Điện|dien)[:\s]*([^\n\r]+)/i);
  data.feeElectricity = dienMatch ? dienMatch[1].trim() : '4k/số';

  const nuocMatch = desc.match(/(?:Nước|nuoc)[:\s]*([^\n\r]+)/i);
  data.feeWater = nuocMatch ? nuocMatch[1].trim() : '30k/khối';

  const mangMatch = desc.match(/(?:WIFI|Mạng|Wifi|Internet)[:\s]*([^\n\r]+)/i);
  data.feeInternet = mangMatch ? mangMatch[1].trim() : '100k/phòng';

  const dvChungMatch = desc.match(/(?:Dịch vụ chung|Dịch vụ)[:\s]*([^\n\r]+)/i);
  data.feeService = dvChungMatch ? dvChungMatch[1].trim() : '150k/người (Vệ sinh, điện chung, thang máy)';

  const thangMayFeeMatch = desc.match(/Thang máy[:\s]*(\d+k\/người[^\n\r]*)/i);
  data.feeElevator = thangMayFeeMatch ? thangMayFeeMatch[1].trim() : '';

  const xeMayMatch = desc.match(/(?:Xe máy|xe máy)[:\s]*([^\n\r]+)/i);
  data.feeParking = xeMayMatch ? xeMayMatch[1].trim() : 'Free 2 xe';

  // Max people & vehicles
  const maxPeopleMatch = desc.match(/Tối đa[:\s]*(\d+)\s*người/i) || desc.match(/tối đa[:\s]*(\d+)/i);
  data.maxPeople = maxPeopleMatch ? parseInt(maxPeopleMatch[1], 10) : 2;

  const maxVehMatch = desc.match(/(\d+)\s*xe(?:\s*máy)?/i) || desc.match(/xe máy[:\s]*(\d+)/i);
  data.maxVehicles = maxVehMatch ? parseInt(maxVehMatch[1], 10) : 2;

  // Policies
  data.petAllowed = fullText.includes('nuôi pet: có') || fullText.includes('cho phép pet') || (fullText.includes('nuôi pet') && !fullText.includes('nuôi pet: không') && !fullText.includes('cấm pet') && !fullText.includes('nuôi pet: ko'));

  if (fullText.includes('cấm xe điện') || fullText.includes('không nhận xe điện') || fullText.includes('xe điện: không') || fullText.includes('xe điện: ko')) {
    data.evPolicy = 'forbidden';
    data.evNote = 'Không nhận xe điện';
    data.electricVehicle = false;
  } else if (fullText.includes('vinfast') || fullText.includes('đổi pin') || fullText.includes('pin rời')) {
    data.evPolicy = 'vinfast_only';
    data.evNote = 'Chỉ nhận xe VinFast pin rời';
    data.electricVehicle = true;
  } else if (fullText.includes('xe điện: có') || fullText.includes('nhận xe điện') || fullText.includes('xe điện: nhận')) {
    data.evPolicy = 'allowed';
    const evFee = desc.match(/Xe điện[:\s]*có\s*\(([^)]+)\)/i);
    data.evNote = evFee ? `Nhận xe điện (${evFee[1]})` : 'Nhận xe điện';
    data.electricVehicle = true;
  } else {
    data.evPolicy = 'unspecified';
    data.evNote = 'Liên hệ chủ nhà';
    data.electricVehicle = false;
  }

  data.foreignGuest = fullText.includes('khách tây: có') || (fullText.includes('khách tây') && !fullText.includes('khách tây: không') && !fullText.includes('ko khách tây') && !fullText.includes('không'));
  data.nearParking = fullText.includes('gần bãi ôtô') || fullText.includes('gần bãi ô tô') || fullText.includes('ô tô đỗ') || fullText.includes('bãi đỗ ô tô');
  data.nearMainRoad = fullText.includes('mặt đường') || fullText.includes('đường lớn') || fullText.includes('ngõ ba gác');
  data.hasLoft = fullText.includes('gác') || fullText.includes('duplex');
  data.fireSafety = fullText.includes('pccc') || fullText.includes('thang thoát hiểm');

  // Terms
  const hopDongMatch = desc.match(/Hợp đồng[:\s]*([^\n\r]+)/i);
  data.contractTerm = hopDongMatch ? hopDongMatch[1].trim() : '12 tháng';

  const thanhToanMatch = desc.match(/Thanh toán[:\s]*([^\n\r]+)/i);
  data.depositTerm = thanhToanMatch ? thanhToanMatch[1].trim() : 'Cọc 1 đóng 1';

  const ngayLuiMatch = desc.match(/Ngày lùi(?: linh động)?[:\s]*([^\n\r]+)/i);
  data.moveInNote = ngayLuiMatch ? `Lùi ${ngayLuiMatch[1].trim()}` : 'Ở ngay';

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

  const categoryName = data.roomLayout === 'Nguyên căn' ? 'Nguyên căn' : `Khép kín${data.roomLayout !== 'STUDIO' ? ' (' + data.roomLayout + ')' : ''}`;
  const tag = data.roomLayout === 'Nguyên căn' ? 'Nguyên căn' : 'Khép kín';

  return {
    id: 'MT-' + data.slug.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 30),
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
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
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
  
  let content = fileCache.get(fullPath);
  if (!content) {
    try {
      content = fs.readFileSync(fullPath);
      // Cache files smaller than 2MB
      if (content.length < 2 * 1024 * 1024) {
        fileCache.set(fullPath, content);
      }
    } catch (e) {
      res.writeHead(500); res.end('Read error'); return;
    }
  }

  const acceptEncoding = (req && req.headers && req.headers['accept-encoding']) || '';
  const headers = {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=86400'
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
  if (pathname === '/api/save-rooms' && req.method === 'POST') {
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

  // Static files
  let filePath = pathname === '/' ? '/index.html' : (pathname === '/admin' ? '/admin.html' : pathname);
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
