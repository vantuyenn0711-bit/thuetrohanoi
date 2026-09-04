#!/usr/bin/env node
// ==========================================================================
// MOITHUE.COM LISTING SCRAPER v2
// Uses sitemap + HTTP to extract all listing data
// No puppeteer needed - pure HTTP approach
// ==========================================================================

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const SITEMAP_URL = 'https://moithue.com/wp-sitemap-posts-listivo_listing-1.xml';
const LOCAL_SLUGS_FILE = path.join(__dirname, 'listing_slugs.json');
const CREDENTIALS = { email: 'Phonghuyentran.moithue@gmail.com', password: 'Huyentran' };
const OUTPUT_FILE = path.join(__dirname, 'rooms_new.json');
const CONCURRENCY = 3; // Parallel requests (lower = less likely to be blocked)
const DELAY_MS = 500; // Delay between batches (higher = less likely to be blocked)
const MAX_RETRIES = 2; // Retry failed listings up to 2 times
const RETRY_DELAY_MS = 2000; // Delay before retry batch

// Source group mapping
const SOURCE_GROUP_MAP = {
  'hoài đức': 'nguon-hoai-duc', 'an khánh': 'nguon-hoai-duc', 'phú vinh': 'nguon-hoai-duc',
  'hinode': 'nguon-hoai-duc', 'di trạch': 'nguon-hoai-duc', 'vân canh': 'nguon-hoai-duc',
  'lai xá': 'nguon-hoai-duc', 'sơn đồng': 'nguon-hoai-duc', 'đông la': 'nguon-hoai-duc',
  'cầu giấy': 'nguon-cau-giay', 'dịch vọng': 'nguon-cau-giay', 'trung hoà': 'nguon-cau-giay',
  'yên hoà': 'nguon-cau-giay', 'thuỵ khê': 'nguon-cau-giay',
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
  'lai xá': 'hoai-duc', 'sơn đồng': 'hoai-duc', 'đông la': 'hoai-duc',
  'cầu giấy': 'cau-giay', 'dịch vọng': 'cau-giay', 'trung hoà': 'cau-giay',
  'yên hoà': 'cau-giay',
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
let cookies = {};

function httpGet(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8',
        'Cookie': Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ')
      },
      timeout: 30000
    };

    const req = https.request(options, (res) => {
      // Parse cookies
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
      res.on('end', () => resolve({ status: res.statusCode, body: data, headers: res.headers }));
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
      port: parsedUrl.port || 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(data),
        'Cookie': Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ')
      },
      timeout: 30000
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
      res.on('end', () => resolve({ status: res.statusCode, body, headers: res.headers, redirectUrl: res.headers.location }));
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(data);
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ======================================================================
// LOGIN
// ======================================================================
async function login() {
  console.log('🔑 Logging into moithue.com...');
  
  // Get login page for cookies
  await httpGet('https://moithue.com/wp-login.php');
  
  // Submit login
  const result = await httpPost('https://moithue.com/wp-login.php', {
    log: CREDENTIALS.email,
    pwd: CREDENTIALS.password,
    'wp-submit': 'Đăng nhập',
    redirect_to: 'https://moithue.com/',
    testcookie: '1'
  });
  
  const loggedIn = cookies['wordpress_logged_in_' + Object.keys(cookies).find(k => k.startsWith('wordpress_logged_in_'))?.replace('wordpress_logged_in_', '')] !== undefined
    || Object.keys(cookies).some(k => k.startsWith('wordpress_logged_in_'));
  
  if (loggedIn) {
    console.log('✅ Login successful!');
    return true;
  }
  
  console.log('❌ Login failed. Continuing without auth...');
  return false;
}

// ======================================================================
// GET SLUGS FROM SITEMAP
// ======================================================================
async function getSlugsFromSitemap() {
  // Try local slugs file first (fastest, most reliable)
  if (fs.existsSync(LOCAL_SLUGS_FILE)) {
    console.log('📋 Loading slugs from local file: listing_slugs.json...');
    try {
      const localSlugs = JSON.parse(fs.readFileSync(LOCAL_SLUGS_FILE, 'utf-8'));
      if (Array.isArray(localSlugs) && localSlugs.length > 0) {
        console.log(`📋 Found ${localSlugs.length} listing URLs from local cache`);
        return localSlugs.map(s => s.replace(/\/$/, ''));
      }
    } catch (e) {
      console.log('⚠️ Failed to parse local slugs file: ' + e.message);
    }
  }
  
  // Fallback: fetch from sitemap
  console.log('📋 Fetching sitemap from server...');
  const res = await httpGet(SITEMAP_URL);
  if (res.status !== 200) throw new Error(`Sitemap fetch failed: HTTP ${res.status}`);
  
  const slugs = [...res.body.matchAll(/<loc>https:\/\/moithue\.com\/listing\/([^<]+)<\/loc>/g)]
    .map(m => m[1].replace(/\/$/, ''));
  
  console.log(`📋 Found ${slugs.length} listing URLs in sitemap`);
  return slugs;
}

// ======================================================================
// EXTRACT ROOM DATA FROM SINGLE LISTING PAGE
// ======================================================================
function extractRoomFromHtml(html, slug) {
  const data = { slug, url: `https://moithue.com/listing/${slug}/` };
  
  // Title from <title> tag
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/);
  if (titleMatch) {
    data.title = titleMatch[1]
      .replace(/&#8211;/g, '-').replace(/&#8217;/g, "'").replace(/&#8216;/g, "'")
      .replace(/&#8230;/g, '...').replace(/&#038;/g, '&').replace(/&amp;/g, '&')
      .replace(/ - Mời Thuê$/, '').trim();
  }
  
  // OG Description (contains address, area, floor, interior, EV info)
  const ogDesc = html.match(/property="og:description"\s+content="([^"]*)"/);
  if (ogDesc) {
    data.description = ogDesc[1]
      .replace(/&#8211;/g, '-').replace(/&#8217;/g, "'").replace(/&#8216;/g, "'")
      .replace(/&#8230;/g, '...').replace(/&#038;/g, '&').replace(/&amp;/g, '&')
      .replace(/&hellip;/g, '...').trim();
  }
  
  // OG Image
  const ogImage = html.match(/property="og:image"\s+content="([^"]*)"/);
  if (ogImage) {
    data.image = ogImage[1].replace(/&#038;/g, '&');
  }
  
  // All images from listing - moithue.com uses Cloudflare R2 signed URLs
  // Strategy: extract from listivo-gallery section first, then fall back to full page
  const r2Pattern = /https:\/\/d21aa69b6f66[^"'\s]+\/moithue-com-prod\/wp-content\/uploads\/([^"'?\s]+\.(?:jpg|jpeg|png|webp))/g;
  const wpPattern = /https:\/\/moithue\.com\/wp-content\/uploads\/([^"'\s]+\.(?:jpg|jpeg|png|webp))/g;
  
  // Try to extract from gallery section first (more accurate)
  let gallerySection = '';
  const galleryIdx = html.indexOf('listivo-gallery');
  if (galleryIdx > -1) {
    gallerySection = html.substring(galleryIdx, Math.min(html.length, galleryIdx + 10000));
  }
  
  // Extract unique image filenames from gallery, then build permanent URLs
  const extractPaths = (text) => {
    const paths = [];
    for (const m of text.matchAll(r2Pattern)) paths.push(m[1]);
    for (const m of text.matchAll(wpPattern)) paths.push(m[1].replace(/&#038;/g, '&'));
    return paths;
  };
  
  let imagePaths = [];
  if (gallerySection) {
    // Extract unique base filenames from gallery (dedup scaled variants)
    const rawPaths = extractPaths(gallerySection);
    const baseNames = new Map(); // base name -> first path
    for (const p of rawPaths) {
      // Get base name: IMG_4040-scaled-1024x768.jpeg -> IMG_4040-scaled.jpeg, 1000019304-scaled-1024x768.jpg -> 1000019304-scaled.jpg
      const baseMatch = p.match(/^(.+?)(?:-\d+x\d+)?(\.jpeg|\.jpg|\.png|\.webp)$/);
      if (baseMatch) {
        const base = baseMatch[1] + baseMatch[2];
        if (!baseNames.has(base)) baseNames.set(base, p);
      } else if (!p.includes('favicon') && !p.includes('cropped-') && !p.includes('Logo')) {
        baseNames.set(p, p);
      }
    }
    imagePaths = [...baseNames.values()];
  }
  
  // Fallback: full page extraction
  if (imagePaths.length === 0) {
    imagePaths = extractPaths(html);
  }
  
  // Convert to permanent URLs, filter out site images
  const permanentImages = imagePaths
    .filter(p => !p.includes('favicon') && !p.includes('cropped-') && !p.includes('Logo') && !p.includes('login_banner') && !p.includes('404') && !p.includes('Gemini_'))
    .filter(p => !p.includes('100x100') && !p.includes('150x150') && !p.includes('180x180') && !p.includes('192x192') && !p.includes('270x270') && !p.includes('32x32'))
    .map(p => 'https://moithue.com/wp-content/uploads/' + p);
  data.images = [...new Set(permanentImages)].slice(0, 6);
  // Fallback: use OG image if no listing photos found
  if (data.images.length === 0) {
    if (data.image) {
      const ogPath = data.image.match(/\/uploads\/([^?]+)/);
      if (ogPath) {
        data.images = ['https://moithue.com/wp-content/uploads/' + ogPath[1]];
      } else {
        data.images = [data.image];
      }
    } else {
      data.images = [DEFAULT_ROOM_IMAGE || 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80'];
    }
  }
  
  // Parse description for structured data
  const desc = data.description || '';
  
  // Price: look for "xxx.xxx đ" or "xxx.xxx đồng" in the page
  const priceMatch = html.match(/(\d{1,3}(?:[.,]\d{3})+)\s*(đ|đồng|VNĐ|₫)/);
  if (priceMatch) {
    data.priceStr = priceMatch[1];
  }
  // Also check og:description for price patterns
  const descPrice = desc.match(/(\d{1,3}(?:[.,]\d{3})+)\s*(đ|đồng)/);
  if (descPrice) {
    data.priceStr = data.priceStr || descPrice[1];
  }
  
  // Area
  const areaMatch = desc.match(/(?:Diện tích|DT|dt)[:\s]*(\d+)\s*m/i) || desc.match(/(\d+)\s*m[²2]/);
  if (areaMatch) data.area = parseInt(areaMatch[1]);
  
  // Address - from description "ĐỊA CHỈ: xxx" or first line
  const addrMatch = desc.match(/(?:ĐỊA CHỈ|Địa chỉ)[:\s]*([^\n\r]+)/i);
  if (addrMatch) {
    data.address = addrMatch[1].trim();
  } else {
    // Try title - it often contains the address
    data.address = data.title || '';
  }
  
  // Floor
  const floorMatch = desc.match(/(?:Thang|Tầng)[:\s]*([^\n\r]+)/i) || desc.match(/(?:Tầng|tang)\s*(\d+)/i);
  if (floorMatch) data.floor = floorMatch[0].trim();
  
  // Status
  const statusMatch = desc.match(/(?:Tình trạng|Trạng thái)[:\s]*([^\n\r]+)/i);
  if (statusMatch) {
    const st = statusMatch[1].toLowerCase();
    data.vacant = st.includes('trống') || st.includes('còn');
  }
  
  // Interior/furniture
  const furnitureMatch = desc.match(/(?:Nội thất|nội thất)[:\s]*([^\n\r]+)/i);
  if (furnitureMatch) data.furniture = furnitureMatch[1].trim();
  
  // EV policy
  const evText = desc.toLowerCase() + ' ' + (data.title || '').toLowerCase();
  if (evText.includes('cấm xe điện') || evText.includes('không nhận xe điện') || evText.includes('cấm sạc')) {
    data.evPolicy = 'forbidden';
  } else if (evText.includes('vinfast') || evText.includes('đổi pin') || evText.includes('pin rời')) {
    data.evPolicy = 'vinfast_only';
  } else if (evText.includes('nhận xe điện') || evText.includes('có xe điện') || evText.includes('xe điện: có')) {
    data.evPolicy = 'allowed';
  } else {
    data.evPolicy = 'unspecified';
  }
  
  // Pet policy
  data.petAllowed = desc.toLowerCase().includes('nuôi pet') || desc.toLowerCase().includes('cho phép pet');
  
  return data;
}

// ======================================================================
// CONVERT TO OUR ROOM FORMAT
// ======================================================================
function convertToRoomFormat(data, index) {
  // Parse price
  let price = 0;
  if (data.priceStr) {
    price = parseInt(data.priceStr.replace(/[.,]/g, '')) || 0;
  }
  
  const area = data.area || 25;
  const sourceGroup = guessSourceGroup(data.address, data.title);
  const district = guessDistrict(data.address);
  
  const evPolicy = data.evPolicy || 'unspecified';
  const evAllowed = evPolicy === 'allowed' || evPolicy === 'vinfast_only';
  let evNote = 'Liên hệ chủ nhà';
  if (evPolicy === 'forbidden') evNote = 'Cấm sạc xe điện';
  else if (evPolicy === 'vinfast_only') evNote = 'Chỉ nhận xe điện VinFast đổi pin';
  else if (evPolicy === 'allowed') evNote = 'Nhận xe điện';
  
  return {
    id: 'MT-' + data.slug.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 30),
    title: data.title || data.slug,
    address: data.address || '',
    district,
    sourceGroup,
    sourceGroupName: SOURCE_GROUP_NAMES[sourceGroup] || sourceGroup,
    roomLayout: 'STUDIO',
    categoryName: 'Khép kín (Studio)',
    tag: 'Khép kín',
    status: data.vacant === false ? 'rented' : 'available',
    statusName: data.vacant === false ? 'Đã cho thuê' : 'Còn phòng',
    price,
    area,
    floor: data.floor || 'Tầng 3 / 6 tầng',
    maxPeople: 2,
    elevator: true,
    furnishLevel: data.furniture ? 'Full đồ' : 'Full đồ',
    maxVehicles: 2,
    petAllowed: data.petAllowed || false,
    electricVehicle: evAllowed,
    electricVehiclePolicy: evPolicy,
    electricVehicleNote: evNote,
    foreignGuest: false,
    nearParking: true,
    nearMainRoad: true,
    loft: false,
    images: data.images.length > 0 ? data.images : [
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80'
    ],
    amenities: ['Điều hòa', 'Nóng lạnh', 'Giường', 'Tủ quần áo'],
    description: data.description || `${data.title} tại ${data.address}.`,
    detailDescription: {
      info: data.address || '',
      amenity: data.furniture || '',
      service: '',
      note: (data.description || '').substring(0, 500)
    },
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
// MERGE WITH EXISTING DATA
// ======================================================================
function mergeData(existingData, newData) {
  const existingBySlug = new Map();
  existingData.forEach(room => {
    if (room.moithueSlug) existingBySlug.set(room.moithueSlug, room);
    if (room.moithueUrl) {
      const m = room.moithueUrl.match(/\/listing\/([^/]+)\//);
      if (m) existingBySlug.set(m[1], room);
    }
  });
  
  const added = [];
  const updated = [];
  
  newData.forEach(newRoom => {
    const slug = newRoom.moithueSlug || '';
    if (existingBySlug.has(slug)) {
      const existing = existingBySlug.get(slug);
      // Keep admin-managed fields
      const merge = { ...newRoom };
      merge.id = existing.id;
      merge.status = existing.status; // Respect admin-set status
      merge.statusName = existing.statusName;
      
      const idx = existingData.findIndex(r => r.moithueSlug === slug);
      if (idx >= 0) {
        existingData[idx] = { ...existingData[idx], ...merge };
        updated.push(slug);
      }
    } else {
      existingData.push(newRoom);
      added.push(slug);
    }
  });
  
  // Remove rooms no longer in sitemap (marked as deleted)
  const newSlugs = new Set(newData.map(r => r.moithueSlug));
  const removed = [];
  existingData = existingData.filter(room => {
    if (room.moithueSlug && !newSlugs.has(room.moithueSlug)) {
      // Don't remove - keep but mark as unavailable
      room.status = 'rented';
      room.statusName = 'Đã cho thuê (không còn trên moithue.com)';
      return true;
    }
    return true;
  });
  
  return { data: existingData, added, updated, removed };
}

// ======================================================================
// MAIN
// ======================================================================
async function main() {
  const startTime = Date.now();
  console.log('🚀 ==========================================');
  console.log('🚀 MOITHUE.COM AUTO SCRAPER v2');
  console.log('🚀 ==========================================');
  console.log(`⏰ Start time: ${new Date().toLocaleString('vi-VN')}`);
  
  try {
    // Step 1: Login (required - listings are behind auth)
    const loginOk = await login();
    if (!loginOk) {
      console.log('⚠️ Login failed - listing pages may require authentication');
      console.log('⚠️ Continuing anyway, some pages may be inaccessible...');
    }
    
    // Step 2: Get all listing slugs from sitemap
    const slugs = await getSlugsFromSitemap();
    
    // Step 3: Fetch and parse each listing page (with retry for failed ones)
    console.log(`\n📥 Fetching ${slugs.length} listing pages (concurrency: ${CONCURRENCY})...`);
    let scraped = [];
    let failedSlugs = [];
    let errors = 0;
    
    async function scrapeBatch(slugList) {
      const results = await Promise.all(slugList.map(async (slug) => {
        try {
          const url = `https://moithue.com/listing/${slug}/`;
          const res = await httpGet(url);
          if (res.status === 200) {
            return extractRoomFromHtml(res.body, slug);
          } else {
            return null;
          }
        } catch (e) {
          return null;
        }
      }));
      return results;
    }
    
    // First pass
    for (let i = 0; i < slugs.length; i += CONCURRENCY) {
      const batch = slugs.slice(i, i + CONCURRENCY);
      const results = await scrapeBatch(batch);
      results.forEach((r, idx) => {
        if (r) scraped.push(r); else { failedSlugs.push(batch[idx]); errors++; }
      });
      const progress = Math.min(i + CONCURRENCY, slugs.length);
      process.stdout.write(`\r  📊 Pass 1: ${progress}/${slugs.length} (${Math.round(progress/slugs.length*100)}%) | OK: ${scraped.length} | Failed: ${errors}`);
      if (i + CONCURRENCY < slugs.length) await sleep(DELAY_MS);
    }
    console.log('');
    
    // Retry failed slugs (slower, one at a time)
    if (failedSlugs.length > 0 && MAX_RETRIES > 0) {
      console.log(`\n🔄 Retrying ${failedSlugs.length} failed listings (${MAX_RETRIES} retries, slower)...`);
      for (let retry = 0; retry < MAX_RETRIES && failedSlugs.length > 0; retry++) {
        console.log(`  Retry ${retry + 1}/${MAX_RETRIES}: ${failedSlugs.length} listings...`);
        await sleep(RETRY_DELAY_MS);
        const retryResults = await scrapeBatch(failedSlugs);
        const stillFailed = [];
        retryResults.forEach((r, idx) => {
          if (r) { scraped.push(r); } else { stillFailed.push(failedSlugs[idx]); }
        });
        failedSlugs = stillFailed;
        console.log(`  ✅ Recovered: ${retryResults.filter(Boolean).length} | Still failed: ${failedSlugs.length}`);
      }
    }
    console.log('');
    
    console.log(`📋 Successfully scraped: ${scraped.length} listings`);
    console.log(`❌ Errors: ${errors}`);
    
    // Step 4: Convert to room format
    console.log(`🔄 Converting ${scraped.length} listings to room format...`);
    const newRooms = scraped.map((data, idx) => convertToRoomFormat(data, idx));
    
    // Step 5: Load existing data
    let existingData = [];
    const dataJsPath = path.join(__dirname, 'js', 'data.js');
    if (fs.existsSync(dataJsPath)) {
      const dataContent = fs.readFileSync(dataJsPath, 'utf-8');
      const match = dataContent.match(/const INITIAL_ROOMS\s*=\s*(\[[\s\S]*?\]);/);
      if (match) {
        try { existingData = JSON.parse(match[1]); } catch(e) { console.log('⚠️ Failed to parse existing data'); }
      }
    }
    
    console.log(`📊 Existing rooms: ${existingData.length}`);
    console.log(`📊 Scraped rooms: ${newRooms.length}`);
    
    // Step 6: Merge
    const result = mergeData(existingData, newRooms);
    
    console.log('');
    console.log('📊 ========= MERGE RESULTS =========');
    console.log(`   ➕ New rooms added: ${result.added.length}`);
    console.log(`   🔄 Rooms updated: ${result.updated.length}`);
    console.log(`   📊 Total rooms: ${result.data.length}`);
    
    // Step 7: Verify data before saving
    console.log('\n🔍 Verifying data integrity...');
    let verifyIssues = 0;
    const verifyIds = new Set();
    result.data.forEach((room, idx) => {
      // Check required fields
      if (!room.id || !room.title || !room.price || !room.address) {
        if (verifyIssues < 5) console.log(`  ⚠️ Room ${idx}: missing required fields`);
        verifyIssues++;
      }
      // Check for duplicate IDs
      if (verifyIds.has(room.id)) {
        if (verifyIssues < 5) console.log(`  ⚠️ Room ${idx}: duplicate ID ${room.id}`);
        verifyIssues++;
      }
      verifyIds.add(room.id);
      // Check price is reasonable (> 500k and < 100M)
      if (room.price && (room.price < 500000 || room.price > 100000000)) {
        if (verifyIssues < 5) console.log(`  ⚠️ Room ${idx}: unusual price ${room.price}`);
        verifyIssues++;
      }
      // Check images array exists
      if (!room.images || !Array.isArray(room.images) || room.images.length === 0) {
        if (verifyIssues < 5) console.log(`  ⚠️ Room ${idx}: no images`);
        verifyIssues++;
      }
    });
    if (verifyIssues === 0) {
      console.log('  ✅ All ' + result.data.length + ' rooms passed verification');
    } else {
      console.log(`  ⚠️ ${verifyIssues} issues found (non-blocking)`);
    }
    
    // Step 8: Save output
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result.data, null, 2), 'utf-8');
    console.log(`\n💾 Saved ${result.data.length} rooms to ${OUTPUT_FILE}`);
    
    // Step 9: Save metadata
    const meta = {
      scrapedAt: new Date().toISOString(),
      duration: Math.round((Date.now() - startTime) / 1000) + 's',
      sourceUrl: 'https://moithue.com',
      sitemapCount: slugs.length,
      scrapedCount: scraped.length,
      errorCount: errors,
      totalRooms: result.data.length,
      addedCount: result.added.length,
      updatedCount: result.updated.length
    };
    fs.writeFileSync(path.join(__dirname, 'scrape_metadata.json'), JSON.stringify(meta, null, 2), 'utf-8');
    
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`\n✅ Scraping complete in ${elapsed}s!`);
    console.log(`📋 Metadata saved to scrape_metadata.json`);
    
  } catch (err) {
    console.error('\n❌ Fatal error:', err.message);
    process.exit(1);
  }
}

main();
