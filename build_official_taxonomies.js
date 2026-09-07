const fs = require('fs');

const DISTRICT_ID_MAP = {
  1039: { slug: 'cau-giay', name: 'Quận Cầu Giấy' },
  1040: { slug: 'hoan-kiem', name: 'Quận Hoàn Kiếm' },
  1041: { slug: 'hai-ba-trung', name: 'Quận Hai Bà Trưng' },
  1042: { slug: 'hoang-mai', name: 'Quận Hoàng Mai' },
  1043: { slug: 'dong-da', name: 'Quận Đống Đa' },
  1044: { slug: 'tay-ho', name: 'Quận Tây Hồ' },
  1045: { slug: 'thanh-xuan', name: 'Quận Thanh Xuân' },
  1046: { slug: 'bac-tu-liem', name: 'Quận Bắc Từ Liêm' },
  1047: { slug: 'ha-dong', name: 'Quận Hà Đông' },
  1048: { slug: 'long-bien', name: 'Quận Long Biên' },
  1049: { slug: 'nam-tu-liem', name: 'Quận Nam Từ Liêm' },
  1050: { slug: 'ba-dinh', name: 'Quận Ba Đình' },
  1217: { slug: 'thanh-tri', name: 'Huyện Thanh Trì' },
  1234: { slug: 'hoai-duc', name: 'Huyện Hoài Đức' }
};

const SOURCE_GROUP_MAP = {
  2202: { slug: 'ngoc-truc-dai-linh', name: 'Ngọc Trục - Đại Linh' },
  2203: { slug: 'me-tri-phu-do', name: 'Mễ Trì - Phú Đô' },
  2196: { slug: 'nguon-ba-dinh', name: 'Ba Đình - Tây Hồ' },
  2191: { slug: 'nguon-cau-dien', name: 'Cầu Diễn' },
  2178: { slug: 'nguon-cau-giay', name: 'Cầu Giấy' },
  2183: { slug: 'nguon-dinh-cong', name: 'Định Công' },
  2194: { slug: 'nguon-dong-da', name: 'Đống Đa' },
  2180: { slug: 'nguon-ha-dong', name: 'Hà Đông' },
  2197: { slug: 'nguon-ho-tung-mau', name: 'Hồ Tùng Mậu' },
  2177: { slug: 'nguon-hoai-duc', name: 'Hoài Đức' },
  2184: { slug: 'nguon-hoang-mai', name: 'Hoàng Mai' },
  2187: { slug: 'nguon-kim-giang-ngoc-hoi', name: 'Kim Giang, Ngọc Hồi' },
  2179: { slug: 'nguon-my-dinh', name: 'Mỹ Đình' },
  2198: { slug: 'nguon-nam-tu-liem', name: 'Nam Từ Liêm' },
  2182: { slug: 'nguon-phu-dien', name: 'Phú Diễn' },
  2199: { slug: 'nguon-tay-ho', name: 'Tây Hồ' },
  2193: { slug: 'nguon-thanh-xuan', name: 'Thanh Xuân' },
  2185: { slug: 'nguon-trieu-khuc', name: 'Triều Khúc' },
  2176: { slug: 'nguon-xuan-dinh', name: 'Cổ Nhuế, Xuân Đỉnh' },
  2181: { slug: 'nguon-xuan-phuong', name: 'Xuân Phương' },
  2186: { slug: 'nguon-yen-xa-mau-luong', name: 'Yên Xá/Mậu Lương' }
};

const DISTRICT_TERMS = JSON.parse(fs.readFileSync('moithue_district_terms.json', 'utf8'));

async function fetchPage(key, termId, page = 1) {
  const payload = {
    'template': 'templates/partials/search_results_card_small',
    'cardType': 'card_small',
    'rowType': 'row_regular_v2',
    'params[page]': String(page),
    'params[limit]': '50',
    'params[sortBy]': 'most-relevant',
    'map': '0',
    'locationFieldId': '0',
    'filters[0][key]': key,
    'filters[0][values][0]': String(termId),
    'filters[0][type]': 'taxonomy'
  };

  const body = new URLSearchParams(payload).toString();
  for (let retry = 0; retry < 3; retry++) {
    try {
      const res = await fetch('https://moithue.com/wp-json/listivo/v1/listings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        body: body,
        signal: AbortSignal.timeout(15000)
      });
      return await res.json();
    } catch (e) {
      await new Promise(r => setTimeout(r, 500));
    }
  }
  return { count: 0, template: '' };
}

function parseSlugs(html) {
  const slugs = [];
  if (!html) return slugs;
  const hrefs = html.match(/href="https:\/\/moithue\.com\/listing\/([^/?#"]+)\/?"/gi) || [];
  for (const h of hrefs) {
    const m = h.match(/\/listing\/([^/?#"]+)/);
    if (m && !slugs.includes(m[1])) slugs.push(m[1]);
  }
  return slugs;
}

async function main() {
  console.log('====================================================');
  console.log('🚀 ĐỒNG BỘ 100% QUẬN/HUYỆN & NHÓM NGUỒN CHUẨN MOITHUE');
  console.log('====================================================');

  const slugToTaxonomy = {};

  // 1. Crawl all Source Groups (21 Nhóm Nguồn)
  console.log('\n📦 1. Đang quét 21 Nhóm Nguồn Hàng từ Moithue...');
  const sgCounts = {};

  for (const [termIdStr, sgInfo] of Object.entries(SOURCE_GROUP_MAP)) {
    const termId = parseInt(termIdStr, 10);
    let page = 1;
    let fetchedSlugs = [];
    const firstData = await fetchPage('listivo_145233', termId, 1);
    const total = firstData.count || 0;
    fetchedSlugs.push(...parseSlugs(firstData.template));

    while (fetchedSlugs.length < total) {
      page++;
      const nextData = await fetchPage('listivo_145233', termId, page);
      const newSlugs = parseSlugs(nextData.template);
      if (newSlugs.length === 0) break;
      fetchedSlugs.push(...newSlugs);
    }

    // De-duplicate
    fetchedSlugs = [...new Set(fetchedSlugs)];
    sgCounts[sgInfo.name] = fetchedSlugs.length;
    console.log(`   -> [${sgInfo.name}]: ${fetchedSlugs.length}/${total} phòng`);

    for (const slug of fetchedSlugs) {
      if (!slugToTaxonomy[slug]) slugToTaxonomy[slug] = {};
      slugToTaxonomy[slug].sourceGroup = sgInfo.slug;
      slugToTaxonomy[slug].sourceGroupName = sgInfo.name;
    }
  }

  // 2. Crawl all Districts (14 Quận / Huyện)
  console.log('\n🗺️ 2. Đang quét 14 Quận / Huyện (và các phường/xã) từ Moithue...');
  const distCounts = {};

  for (const [distIdStr, distInfo] of Object.entries(DISTRICT_ID_MAP)) {
    const distId = parseInt(distIdStr, 10);
    // Find all terms for this district (itself + wards)
    const terms = DISTRICT_TERMS.filter(t => t.id === distId || t.parent === distId);
    let districtSlugs = new Set();

    for (const t of terms) {
      let page = 1;
      const firstData = await fetchPage('listivo_15029', t.id, 1);
      const total = firstData.count || 0;
      if (total === 0) continue;

      parseSlugs(firstData.template).forEach(s => districtSlugs.add(s));
      let currentLoaded = parseSlugs(firstData.template).length;

      while (currentLoaded < total) {
        page++;
        const nextData = await fetchPage('listivo_15029', t.id, page);
        const newSlugs = parseSlugs(nextData.template);
        if (newSlugs.length === 0) break;
        newSlugs.forEach(s => districtSlugs.add(s));
        currentLoaded += newSlugs.length;
      }
    }

    distCounts[distInfo.name] = districtSlugs.size;
    console.log(`   -> [${distInfo.name}]: ${districtSlugs.size} phòng`);

    for (const slug of districtSlugs) {
      if (!slugToTaxonomy[slug]) slugToTaxonomy[slug] = {};
      slugToTaxonomy[slug].district = distInfo.slug;
      slugToTaxonomy[slug].districtName = distInfo.name;
    }
  }

  // Save mapping file
  fs.writeFileSync('moithue_official_mapping.json', JSON.stringify(slugToTaxonomy, null, 2), 'utf8');
  console.log(`\n💾 Đã lưu mapping chính thức của ${Object.keys(slugToTaxonomy).length} phòng vào moithue_official_mapping.json!`);

  // 3. Cập nhật vào rooms_new.json
  console.log('\n⚙️ 3. Đang cập nhật vào rooms_new.json...');
  const rooms = JSON.parse(fs.readFileSync('rooms_new.json', 'utf8'));
  let updatedCount = 0;
  let unmappedDist = 0;
  let unmappedSG = 0;

  for (const room of rooms) {
    const slug = room.moithueSlug || (room.moithueUrl ? room.moithueUrl.match(/\/listing\/([^/?#"]+)/)?.[1] : null) || room.id.replace(/^MT-/, '');
    const mapped = slugToTaxonomy[slug];

    if (mapped) {
      if (mapped.district) {
        room.district = mapped.district;
      } else {
        unmappedDist++;
      }

      if (mapped.sourceGroup) {
        room.sourceGroup = mapped.sourceGroup;
        room.sourceGroupName = mapped.sourceGroupName;
      } else {
        unmappedSG++;
      }
      updatedCount++;
    } else {
      unmappedDist++;
      unmappedSG++;
    }
  }

  fs.writeFileSync('rooms_new.json', JSON.stringify(rooms, null, 2), 'utf8');
  console.log(`✅ Đã cập nhật thành công ${updatedCount}/${rooms.length} phòng trong rooms_new.json!`);
  if (unmappedDist > 0) console.log(`⚠️ Có ${unmappedDist} phòng chưa có Quận chính thức`);
  if (unmappedSG > 0) console.log(`⚠️ Có ${unmappedSG} phòng chưa có Nhóm Nguồn chính thức`);

  // Print final summary
  console.log('\n====================================================');
  console.log('📊 TỔNG HỢP SỐ LƯỢNG SAU KHI ĐỒNG BỘ:');
  console.log('====================================================');
  console.log('--- Quận / Huyện ---');
  const actualDistCounts = {};
  rooms.forEach(r => { actualDistCounts[r.district] = (actualDistCounts[r.district] || 0) + 1; });
  console.log(actualDistCounts);

  console.log('\n--- Nhóm Nguồn Hàng ---');
  const actualSGCounts = {};
  rooms.forEach(r => { actualSGCounts[r.sourceGroup] = (actualSGCounts[r.sourceGroup] || 0) + 1; });
  console.log(actualSGCounts);
}

main().catch(console.error);
