// ==========================================================================
// THÔNG TIN CHUYÊN VIÊN TƯ VẤN & DỮ LIỆU ĐỒNG BỘ CHUẨN XÁC
// Chuyên viên: Đặng Văn Tuyển - SĐT / Zalo: 0358954360
// Bộ đếm được tính toán động 100% dựa trên số lượng phòng thực tế
// ==========================================================================

const DISTRICTS = [
  { id: "all", name: "Tất cả Quận / Huyện" },
  { id: "cau-giay", name: "Quận Cầu Giấy" },
  { id: "hoang-mai", name: "Quận Hoàng Mai" },
  { id: "nam-tu-liem", name: "Quận Nam Từ Liêm" },
  { id: "hoai-duc", name: "Huyện Hoài Đức" },
  { id: "tay-ho", name: "Quận Tây Hồ" },
  { id: "bac-tu-liem", name: "Quận Bắc Từ Liêm" },
  { id: "thanh-xuan", name: "Quận Thanh Xuân" },
  { id: "ba-dinh", name: "Quận Ba Đình" },
  { id: "dong-da", name: "Quận Đống Đa" },
  { id: "hai-ba-trung", name: "Quận Hai Bà Trưng" },
  { id: "ha-dong", name: "Quận Hà Đông" },
  { id: "hoan-kiem", name: "Quận Hoàn Kiếm" },
  { id: "long-bien", name: "Quận Long Biên" }
];

const SOURCE_GROUPS = [
  { id: "all", name: "Tất cả Nhóm Nguồn Hàng" },
  { id: "nguon-ba-dinh", name: "Ba Đình - Tây Hồ" },
  { id: "nguon-bach-kinh-xay", name: "Bách Kinh Xây" },
  { id: "nguon-cau-dien", name: "Cầu Diễn" },
  { id: "nguon-cau-giay", name: "Cầu Giấy" },
  { id: "nguon-xuan-dinh", name: "Cổ Nhuế, Xuân Đỉnh" },
  { id: "nguon-dinh-cong", name: "Định Công" },
  { id: "nguon-dong-da", name: "Đống Đa" },
  { id: "nguon-ha-dong", name: "Hà Đông" },
  { id: "nguon-ho-tung-mau", name: "Hồ Tùng Mậu" },
  { id: "nguon-hoai-duc", name: "Hoài Đức" },
  { id: "nguon-hoang-mai", name: "Hoàng Mai" },
  { id: "nguon-kim-giang-ngoc-hoi", name: "Kim Giang, Ngọc Hồi" },
  { id: "nguon-linh-nam-vinh-hung", name: "Lĩnh Nam - Vĩnh Hưng" },
  { id: "me-tri-phu-do", name: "Mễ Trì - Phú Đô" },
  { id: "nguon-my-dinh", name: "Mỹ Đình" },
  { id: "nguon-nam-tu-liem", name: "Nam Từ Liêm" },
  { id: "nguon-phu-dien", name: "Phú Diễn" },
  { id: "nguon-tay-ho", name: "Tây Hồ" },
  { id: "nguon-thanh-xuan", name: "Thanh Xuân" },
  { id: "nguon-trieu-khuc", name: "Triều Khúc" },
  { id: "nguon-xuan-phuong", name: "Xuân Phương" },
  { id: "nguon-yen-xa-mau-luong", name: "Yên Xá/Mậu Lương" },
  { id: "ngoc-truc-dai-linh", name: "Ngọc Trục - Đại Linh" }
];

const PRICE_RANGES = [
  { id: "under-3m", label: "Dưới 3 triệu", min: 0, max: 3000000 },
  { id: "3m-5m", label: "3 - 5 triệu", min: 3000000, max: 5000000 },
  { id: "5m-8m", label: "5 - 8 triệu", min: 5000000, max: 8000000 },
  { id: "8m-12m", label: "8 - 12 triệu", min: 8000000, max: 12000000 },
  { id: "12m-20m", label: "12 - 20 triệu", min: 12000000, max: 20000000 },
  { id: "over-20m", label: "Trên 20 triệu", min: 20000000, max: Infinity }
];

const INITIAL_ROOMS = [];

if (typeof module !== "undefined" && module.exports) {
  module.exports = { DISTRICTS, SOURCE_GROUPS, PRICE_RANGES, INITIAL_ROOMS };
}
