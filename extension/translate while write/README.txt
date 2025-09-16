ALT Input Translator (robust)
-----------------------------
Hotkey: Alt (single key)
- Focus vào input, textarea hoặc contenteditable (Facebook, Messenger, ...)
- Nhấn Alt để dịch text sang ngôn ngữ đích (TARGET_LANG trong content.js).
- Với contenteditable, extension thử nhiều cách (synthetic paste event, execCommand('paste'), manual insert) và dừng ngay khi thấy nội dung đã thay đổi — tránh duplicate.
- Nếu website chặn paste hoàn toàn, extension sẽ copy kết quả vào clipboard thay thế.

Cài đặt:
1. Giải nén ZIP này ra một thư mục
2. Vào chrome://extensions, bật Developer mode
3. Load unpacked -> chọn thư mục vừa giải nén

LƯU Ý:
- Thay API_KEY trong content.js nếu bạn dùng Google Translate API riêng.
- Một số trang web có thể chặn paste; extension cố gắng nhiều cách nhưng không thể đảm bảo 100% trên mọi trang.