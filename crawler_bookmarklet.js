// ==========================================================================
// CÀO PHÒNG TRỰC TIẾP TRÊN TRÌNH DUYỆT (100% KHÔNG BAO GIỜ BỊ CHẶN CLOUDFLARE)
// Cách dùng: Mở moithue.com -> F12 -> Console -> Dán đoạn code này vào -> Enter
// ==========================================================================
(async function initMoithueCrawler() {
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

        // Images
        const images = [];
        doc.querySelectorAll('img').forEach(img => {
          const src = img.src || img.getAttribute('src') || img.dataset.src || '';
          if (src && src.startsWith('http') && !src.includes('svg') && !src.includes('logo') && !src.includes('avatar')) {
            images.push(src);
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

        results.push({
          id: 'MT-' + slug,
          title: title,
          address: address,
          price: price,
          priceUnit: 'tháng',
          area: area,
          roomLayout: roomLayout,
          furnishLevel: 'Full đồ',
          district: 'cau-giay',
          sourceGroup: 'nguon-cau-giay',
          sourceGroupName: 'Cầu Giấy',
          status: 'available',
          statusName: 'Còn phòng',
          depositTerm: 'Cọc 1 đóng 1',
          images: cleanImages.length > 0 ? cleanImages : ['https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80'],
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
