@echo off
chcp 65001 >nul
title Thuê Trọ - Khởi Động Hệ Thống
cd /d "%~dp0"

echo.
echo ========================================================
echo   🚀 HỆ THỐNG QUẢN LÝ VÀ ĐĂNG PHÒNG TRỌ
echo ========================================================
echo.
echo   [*] Đang dọn dẹp tiến trình cũ và khởi động server...
echo.

:: Tắt tiến trình node cũ nếu có
taskkill /F /IM node.exe >nul 2>&1

:: Khởi động server Node.js trong cửa sổ riêng
start "Server Thuê Trọ (Đang chạy)" cmd /k "chcp 65001 >nul && cd /d ""%~dp0"" && node server.js"

:: Chờ 2 giây cho server sẵn sàng
timeout /t 2 /nobreak >nul

:: Mở trang web và trang quản trị trên trình duyệt mặc định
start http://localhost:3000/admin.html
start http://localhost:3000/index.html

echo.
echo   ========================================================
echo   ✅ ĐÃ KHỞI ĐỘNG THÀNH CÔNG!
echo   --------------------------------------------------------
echo   🌐 Trang Quản Trị (Admin): http://localhost:3000/admin.html
echo   🏠 Trang Chủ Khách Xem:    http://localhost:3000/index.html
echo   ========================================================
echo.
echo   Mẹo: Khi muốn tắt hệ thống, chỉ cần đóng cửa sổ cmd server.
echo.
pause

