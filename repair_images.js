#!/usr/bin/env node
// ==========================================================================
// REPAIR IMAGES - Sửa nhanh ảnh phòng thiếu gallery + R2 URL hết hạn
// Chạy: node repair_images.js
// ==========================================================================

const { repairIncompleteRooms, fixR2Url } = require('./sync_rooms');
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'rooms_new.json');

async function main() {
  console.log('🔧 Repair Images - Sửa chữa ảnh phòng thiếu gallery\n');

  // Đọc DB
  const rooms = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  console.log(`📁 Đọc được ${rooms.length} phòng từ rooms_new.json`);

  // Thống kê trước
  const before1img = rooms.filter(r => (r.images || []).length <= 1).length;
  const beforeR2 = rooms.filter(r => (r.images || []).some(i => i.includes('r2.cloudflarestorage'))).length;
  console.log(`\n📊 TRƯỚC KHI SỬA:`);
  console.log(`   Phòng chỉ có ≤1 ảnh: ${before1img}`);
  console.log(`   Phòng dùng R2 URL: ${beforeR2}`);

  // Chạy repair
  const result = await repairIncompleteRooms(rooms);

  // Lưu lại
  fs.writeFileSync(DB_FILE, JSON.stringify(rooms, null, 2), 'utf8');
  console.log(`\n💾 Đã lưu lại rooms_new.json`);

  // Thống kê sau
  const after1img = rooms.filter(r => (r.images || []).length <= 1).length;
  const afterR2 = rooms.filter(r => (r.images || []).some(i => i.includes('r2.cloudflarestorage'))).length;
  console.log(`\n📊 SAU KHI SỬA:`);
  console.log(`   Phòng chỉ có ≤1 ảnh: ${after1img} (giảm ${before1img - after1img})`);
  console.log(`   Phòng dùng R2 URL: ${afterR2} (giảm ${beforeR2 - afterR2})`);
  
  // Image distribution
  const stats = {};
  rooms.forEach(r => {
    const c = (r.images || []).length;
    stats[c] = (stats[c] || 0) + 1;
  });
  console.log(`\n📊 Phân bổ số ảnh:`);
  Object.keys(stats).sort((a,b) => a-b).forEach(k => console.log(`   ${k} ảnh: ${stats[k]} phòng`));
}

main().catch(err => {
  console.error('❌ Lỗi:', err);
  process.exit(1);
});
