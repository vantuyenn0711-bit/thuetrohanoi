// ==========================================================================
// CÀO PHÒNG TRỰC TIẾP TRÊN TRÌNH DUYỆT (100% KHÔNG BAO GIỜ BỊ CHẶN CLOUDFLARE)
// Cách dùng: Mở moithue.com -> F12 -> Console -> Dán đoạn code này vào -> Enter
// ==========================================================================
(async function initMoithueCrawler() {
  const DISTRICT_MAP = {
    'hoài đức': 'hoai-duc', 'an khánh': 'hoai-duc', 'phú vinh': 'hoai-duc', 'hinode': 'hoai-duc', 'di trạch': 'hoai-duc', 'vân canh': 'hoai-duc', 'kim chung': 'hoai-duc',
    'cầu giấy': 'cau-giay', 'dịch vọng': 'cau-giay', 'trung hoà': 'cau-giay', 'quan hoa': 'cau-giay', 'yên hoà': 'cau-giay',
    'hoàng mai': 'hoang-mai', 'định công': 'hoang-mai', 'lĩnh nam': 'hoang-mai', 'vĩnh hưng': 'hoang-mai', 'tân mai': 'hoang-mai', 'giáp bát': 'hoang-mai', 'đại kim': 'hoang-mai', 'hoàng liệt': 'hoang-mai', 'tương mai': 'hoang-mai',
    'thanh trì': 'thanh-tri', 'tân triều': 'thanh-tri', 'triều khúc': 'thanh-tri', 'thanh liệt': 'thanh-tri', 'ngọc hồi': 'thanh-tri', 'tứ hiệp': 'thanh-tri', 'hữu hoà': 'thanh-tri', 'tam hiệp': 'thanh-tri',
    'mỹ đình': 'nam-tu-liem', 'nam từ liêm': 'nam-tu-liem', 'mễ trì': 'nam-tu-liem', 'phú đô': 'nam-tu-liem', 'cầu diễn': 'nam-tu-liem', 'tây mỗ': 'nam-tu-liem', 'đại mỗ': 'nam-tu-liem', 'trung văn': 'nam-tu-liem', 'xuân phương': 'nam-tu-liem',
    'bắc từ liêm': 'bac-tu-liem', 'xuân đỉnh': 'bac-tu-liem', 'cổ nhuế': 'bac-tu-liem', 'phú diễn': 'bac-tu-liem', 'phúc diễn': 'bac-tu-liem', 'minh khai': 'bac-tu-liem', 'đông ngạc': 'bac-tu-liem',
    'thanh xuân': 'thanh-xuan', 'khương đình': 'thanh-xuan', 'khương trung': 'thanh-xuan', 'khương mai': 'thanh-xuan', 'nhân chính': 'thanh-xuan', 'phương liệt': 'thanh-xuan', 'thượng đình': 'thanh-xuan', 'hạ đình': 'thanh-xuan',
    'ba đình': 'ba-dinh', 'đội cấn': 'ba-dinh', 'kim mã': 'ba-dinh', 'ngọc hà': 'ba-dinh', 'giảng võ': 'ba-dinh', 'cống vị': 'ba-dinh', 'liễu giai': 'ba-dinh',
    'tây hồ': 'tay-ho', 'xuân la': 'tay-ho', 'yên phụ': 'tay-ho', 'quảng an': 'tay-ho', 'nhật tân': 'tay-ho', 'bưởi': 'tay-ho', 'phú thượng': 'tay-ho', 'thụy khuê': 'tay-ho',
    'đống đa': 'dong-da', 'láng': 'dong-da', 'khâm thiên': 'dong-da', 'kim liên': 'dong-da', 'phương mai': 'dong-da', 'văn miếu': 'dong-da', 'ngã tư sở': 'dong-da', 'ô chợ dừa': 'dong-da',
    'hai bà trưng': 'hai-ba-trung', 'bạch mai': 'hai-ba-trung', 'vĩnh tuy': 'hai-ba-trung', 'thanh nhàn': 'hai-ba-trung', 'trương định': 'hai-ba-trung', 'đồng tâm': 'hai-ba-trung',
    'hà đông': 'ha-dong', 'văn quán': 'ha-dong', 'mỗ lao': 'ha-dong', 'kiến hưng': 'ha-dong', 'yên nghĩa': 'ha-dong', 'phú la': 'ha-dong', 'yên xá': 'ha-dong',
    'hoàn kiếm': 'hoan-kiem', 'hàng bài': 'hoan-kiem'
  };

  const SOURCE_GROUP_RULES = [
    { id: 'nguon-trieu-khuc', name: 'Triều Khúc', keys: ['triều khúc', 'tân triều'] },
    { id: 'nguon-dinh-cong', name: 'Định Công', keys: ['định công', 'trần điền', 'lê trọng tấn (hoàng mai)'] },
    { id: 'nguon-kim-giang-ngoc-hoi', name: 'Kim Giang, Ngọc Hồi', keys: ['kim giang', 'ngọc hồi', 'thanh liệt', 'linh đàm', 'hoàng liệt'] },
    { id: 'nguon-yen-xa-mau-luong', name: 'Yên Xá/Mậu Lương', keys: ['yên xá', 'mậu lương', 'kiến hưng', 'xa la'] },
    { id: 'me-tri-phu-do', name: 'Mễ Trì - Phú Đô', keys: ['mễ trì', 'phú đô', 'đồng me', 'đỗ đức dục'] },
    { id: 'ngoc-truc-dai-linh', name: 'Ngọc Trục - Đại Linh', keys: ['ngọc trục', 'đại linh', 'trung văn'] },
    { id: 'nguon-cau-dien', name: 'Cầu Diễn', keys: ['cầu diễn', 'kiều mai', 'nguyễn đổng chi'] },
    { id: 'nguon-phu-dien', name: 'Phú Diễn', keys: ['phú diễn', 'phúc diễn', 'đức diễn', 'hoàng công chất'] },
    { id: 'nguon-xuan-phuong', name: 'Xuân Phương', keys: ['xuân phương', 'phương canh', 'vân canh', 'trịnh văn bô'] },
    { id: 'nguon-ho-tung-mau', name: 'Hồ Tùng Mậu', keys: ['hồ tùng mậu', 'mai dịch', 'doãn kế thiện', 'nguyễn khả trạc'] },
    { id: 'nguon-co-nhue-xuan-dinh', name: 'Cổ Nhuế , Xuân Đỉnh', keys: ['cổ nhuế', 'xuân đỉnh', 'tân xuân', 'phạm văn đồng', 'đông ngạc'] },
    { id: 'nguon-my-dinh', name: 'Mỹ Đình', keys: ['mỹ đình', 'đình thôn', 'nhân mỹ', 'thiên hiền', 'lê đức thọ', 'nguyễn hoàng'] },
    { id: 'nguon-ba-dinh-tay-ho', name: 'Ba Đình - Tây Hồ', keys: ['ba đình', 'tây hồ', 'đội cấn', 'kim mã', 'ngọc hà', 'giảng võ', 'xuân la', 'lạc long quân', 'thụy khuê', 'trích sài', 'yên phụ', 'bưởi', 'võ chí công'] },
    { id: 'nguon-cau-giay', name: 'Cầu Giấy', keys: ['cầu giấy', 'dịch vọng', 'trung hoà', 'quan hoa', 'yên hoà', 'nguyễn khang', 'trần thái tông', 'duy tân', 'trần duy hưng', 'nguyễn phong sắc', 'hoàng quốc việt', 'hoa bằng'] },
    { id: 'nguon-dong-da', name: 'Đống Đa', keys: ['đống đa', 'chùa láng', 'pháo đài láng', 'nguyên hồng', 'thái hà', 'thái thịnh', 'tây sơn', 'tôn đức thắng', 'xã đàn', 'khâm thiên', 'đê la thành', 'hào nam'] },
    { id: 'nguon-thanh-xuan', name: 'Thanh Xuân', keys: ['thanh xuân', 'nguyễn trãi', 'khương đình', 'khương trung', 'khương mai', 'nhân chính', 'vương thừa vũ', 'hoàng văn thái', 'ngụy như kon tum', 'lê văn lương', 'quan nhân'] },
    { id: 'nguon-ha-dong', name: 'Hà Đông', keys: ['hà đông', 'mỗ lao', 'văn quán', 'văn phú', 'quang trung (hà đông)', 'tố hữu', 'vạn phúc', 'chiến thắng', 'bế văn đàn'] },
    { id: 'nguon-hoang-mai', name: 'Hoàng Mai', keys: ['hoàng mai', 'giáp bát', 'tân mai', 'trương định', 'vĩnh hưng', 'lĩnh nam', 'tam trinh', 'đại từ', 'đền lừ'] },
    { id: 'nguon-hoai-duc', name: 'Hoài Đức', keys: ['hoài đức', 'an khánh', 'geleximco', 'hinode', 'kim chung'] }
  ];

  function guessDistrict(text) {
    if (!text) return 'cau-giay';
    const lower = text.toLowerCase();
    for (const [kw, dist] of Object.entries(DISTRICT_MAP)) {
      if (lower.includes(kw)) return dist;
    }
    return 'cau-giay';
  }

  function guessSourceGroup(text) {
    if (!text) return { id: 'nguon-cau-giay', name: 'Cầu Giấy' };
    const lower = text.toLowerCase();
    for (const rule of SOURCE_GROUP_RULES) {
      if (rule.keys.some(k => lower.includes(k))) {
        return { id: rule.id, name: rule.name };
      }
    }
    return { id: 'nguon-cau-giay', name: 'Cầu Giấy' };
  }

  if (document.getElementById('mt-crawler-modal')) {
    document.getElementById('mt-crawler-modal').remove();
  }

  const modal = document.createElement('div');
  modal.id = 'mt-crawler-modal';
  modal.style.cssText = `
    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
    width: 600px; max-width: 95vw; background: white; border-radius: 16px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.4); z-index: 9999999;
    padding: 24px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    border: 2px solid #0D9488; color: #1e293b;
  `;

  modal.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
      <h3 style="margin: 0; font-size: 1.25rem; font-weight: 800; color: #0D9488; display: flex; align-items: center; gap: 8px;">
        🚀 CÀO PHÒNG NHANH MOITHUE.COM
      </h3>
      <button onclick="document.getElementById('mt-crawler-modal').remove()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #64748b;">&times;</button>
    </div>
    <p style="margin: 0 0 12px 0; font-size: 0.85rem; color: #64748b;">
      Dán danh sách link phòng cần cào (mỗi dòng 1 link). Trình duyệt của bạn sẽ tự động bóc tách đầy đủ hình ảnh chất lượng cao và tải về file JSON:
    </p>
    <textarea id="mt-crawler-input" rows="6" placeholder="https://moithue.com/listing/slug-1/&#10;https://moithue.com/listing/slug-2/..." 
      style="width: 100%; box-sizing: border-box; padding: 12px; border: 1.5px solid #cbd5e1; border-radius: 8px; font-family: monospace; font-size: 0.85rem; outline: none; margin-bottom: 14px;"></textarea>
    
    <div id="mt-crawler-status" style="margin-bottom: 14px; display: none;">
      <div style="display: flex; justify-content: space-between; font-weight: 700; font-size: 0.85rem; margin-bottom: 6px;">
        <span id="mt-progress-text">Đang cào phòng...</span>
        <span id="mt-progress-percent" style="color: #0D9488;">0%</span>
      </div>
      <div style="width: 100%; height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden;">
        <div id="mt-progress-bar" style="width: 0%; height: 100%; background: #0D9488; transition: width 0.2s;"></div>
      </div>
    </div>

    <div style="display: flex; justify-content: flex-end; gap: 10px;">
      <button onclick="document.getElementById('mt-crawler-modal').remove()" style="padding: 10px 18px; border: 1px solid #cbd5e1; background: #f8fafc; border-radius: 8px; font-weight: 600; cursor: pointer;">Hủy</button>
      <button id="mt-crawler-start-btn" style="padding: 10px 22px; border: none; background: #0D9488; color: white; border-radius: 8px; font-weight: 700; cursor: pointer;">▶ BẮT ĐẦU CÀO VÀ TẢI FILE JSON</button>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById('mt-crawler-start-btn').onclick = async () => {
    const rawText = document.getElementById('mt-crawler-input').value.trim();
    const links = rawText.match(/https?:\/\/(?:www\.)?moithue\.com\/listing\/[a-zA-Z0-9_\-]+(?:\/)?/gi) || [];

    if (links.length === 0) {
      alert('Vui lòng dán ít nhất 1 link phòng!');
      return;
    }

    const startBtn = document.getElementById('mt-crawler-start-btn');
    const statusBox = document.getElementById('mt-crawler-status');
    const progText = document.getElementById('mt-progress-text');
    const progPercent = document.getElementById('mt-progress-percent');
    const progBar = document.getElementById('mt-progress-bar');

    startBtn.disabled = true;
    startBtn.style.opacity = '0.6';
    statusBox.style.display = 'block';

    const results = [];
    const parser = new DOMParser();

    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      const percent = Math.round(((i + 1) / links.length) * 100);
      progText.innerText = `Đang xử lý [${i + 1}/${links.length}]: ${link.replace('https://moithue.com/listing/', '').slice(0, 25)}...`;
      progPercent.innerText = `${percent}%`;
      progBar.style.width = `${percent}%`;

      try {
        const slugMatch = link.match(/\/listing\/([^/?#]+)/i);
        const slug = slugMatch ? slugMatch[1] : '';

        const res = await fetch(link, { credentials: 'include' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const html = await res.text();
        const doc = parser.parseFromString(html, 'text/html');

        // Extract Data
        const titleEl = doc.querySelector('.listivo-listing-hero__title') || doc.querySelector('h1') || doc.querySelector('.entry-title');
        let title = titleEl ? titleEl.textContent.trim() : '';

        const priceEl = doc.querySelector('.listivo-listing-hero__price') || doc.querySelector('[class*="price"]');
        let priceStr = priceEl ? priceEl.textContent.trim().replace(/\D/g, '') : '0';
        let price = parseInt(priceStr, 10) || 0;

        const addressEl = doc.querySelector('.listivo-listing-hero__address') || doc.querySelector('[class*="address"]');
        let address = addressEl ? addressEl.textContent.trim() : title;

        // Images extraction (Full resolution from gallery and body)
        const images = [];
        doc.querySelectorAll('a[href*="/uploads/"], img').forEach(el => {
          let src = el.getAttribute('href') || el.src || el.getAttribute('src') || el.dataset.src || el.dataset.lazySrc || '';
          if (src.startsWith('/')) src = 'https://moithue.com' + src;
          if (src && src.startsWith('http') && src.includes('/uploads/') && !src.includes('svg') && !src.includes('logo') && !src.includes('avatar')) {
            const cleanUrl = src.replace(/-\d+x\d+(\.[a-zA-Z]+)$/, '$1');
            images.push(cleanUrl);
          }
        });
        const cleanImages = [...new Set(images)];

        // Description
        const descEl = doc.querySelector('.listivo-listing-content') || doc.querySelector('.entry-content') || doc.querySelector('.listing-content');
        let desc = descEl ? descEl.innerText.trim() : '';

        // Amenities
        const amenities = [];
        doc.querySelectorAll('.listivo-amenity, [class*="amenit"]').forEach(el => {
          const t = el.textContent.trim();
          if (t && t.length < 40) amenities.push(t);
        });

        // Area
        let area = 25;
        const areaMatch = desc.match(/(?:Diện tích|DT|diện tích)\s*[:•~]?\s*(\d+(?:\.\d+)?)\s*m/i) || html.match(/(\d+)\s*m²/);
        if (areaMatch) area = parseFloat(areaMatch[1]);

        // Layout
        let roomLayout = 'STUDIO';
        if (/nguyên căn/i.test(desc) || /nguyên căn/i.test(title)) roomLayout = 'Nguyên căn';
        else if (/3n1k|3 phòng ngủ/i.test(desc) || /3n1k/i.test(title)) roomLayout = '3N1K';
        else if (/2n1k|2 phòng ngủ/i.test(desc) || /2n1k/i.test(title)) roomLayout = '2N1K';
        else if (/1n1k|1 phòng ngủ/i.test(desc) || /1n1k/i.test(title)) roomLayout = '1N1K';
        else if (/gác|duplex/i.test(desc) || /gác|duplex/i.test(title)) roomLayout = 'Gác lửng';

        const guessedDistrict = guessDistrict(address + ' ' + title + ' ' + desc);
        const guessedSource = guessSourceGroup(address + ' ' + title + ' ' + desc);

        results.push({
          id: 'MT-' + slug,
          title: title,
          address: address,
          price: price,
          priceUnit: 'tháng',
          area: area,
          roomLayout: roomLayout,
          furnishLevel: 'Full đồ',
          district: guessedDistrict,
          sourceGroup: guessedSource.id,
          sourceGroupName: guessedSource.name,
          status: 'available',
          statusName: 'Còn phòng',
          depositTerm: 'Cọc 1 đóng 1',
          images: cleanImages,
          amenities: amenities.length > 0 ? [...new Set(amenities)] : ['Điều hòa', 'Nóng lạnh', 'Giường', 'Tủ quần áo'],
          description: desc || title,
          detailDescription: {
            info: `ĐỊA CHỈ: ${address}\nDiện tích: ${area}m2\nDạng phòng: ${roomLayout}`,
            amenity: `• Nội thất: Đầy đủ tiện nghi`,
            service: `• Điện nước theo giá quy định`,
            note: `• Hợp đồng linh hoạt`
          },
          moveInStatus: 'Ở ngay',
          featured: false,
          views: 1,
          moithueUrl: link,
          moithueSlug: slug,
          createdAt: new Date().toISOString()
        });
      } catch (err) {
        console.warn(`Lỗi link ${link}:`, err);
      }

      await new Promise(r => setTimeout(r, 200));
    }

    if (results.length > 0) {
      const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `moithue_rooms_${results.length}_phong.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      alert(`🎉 ĐÃ CÀO XONG ${results.length}/${links.length} PHÒNG!\nFile JSON đã được tải về máy của bạn.\n\nBây giờ bạn chỉ cần vào trang Admin -> Bấm nút [Nhập JSON] là xong 100%!`);
      modal.remove();
    } else {
      alert('❌ Không cào được phòng nào, vui lòng kiểm tra lại danh sách link!');
      startBtn.disabled = false;
      startBtn.style.opacity = '1';
    }
  };
})();
