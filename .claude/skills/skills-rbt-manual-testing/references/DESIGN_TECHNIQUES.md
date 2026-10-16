# Quy Tắc Áp Dụng Kỹ Thuật Thiết Kế Test Case

> **Mục đích:** Hướng dẫn điều kiện bắt buộc áp dụng các kỹ thuật thiết kế kiểm thử tiêu chuẩn (EP, BVA, Decision Table, State Transition) thay vì chỉ liệt kê tên kỹ thuật theo cảm tính.
> **Áp dụng cho:** Tất cả các mode sinh test case (QUICK, FULL RBT, DELTA).

---

## 1. Điều Kiện Bắt Buộc Áp Dụng

| Kỹ thuật | Điều kiện BẮT BUỘC áp dụng | Cách làm |
|---|---|---|
| **EP + BVA** | Mọi field có ràng buộc min/max/format | Mỗi partition $\ge 1$ TC; biên test tại `min-1, min, max, max+1` |
| **Decision Table** | Có **$\ge 3$ điều kiện kết hợp** ảnh hưởng đến 1 output (VD: loại KH × hạn mức × trạng thái $\rightarrow$ được duyệt?) | Lập bảng đầy đủ tổ hợp $\rightarrow$ mỗi rule (cột) = 1 TC. Nếu $>20$ tổ hợp $\rightarrow$ dùng pairwise và ghi chú lý do rút gọn |
| **State Transition** | Entity có **$\ge 3$ trạng thái** hoặc có status flow (Draft $\rightarrow$ Pending $\rightarrow$ Approved...) | Vẽ bảng transition $\rightarrow$ TC cho mọi transition hợp lệ + TC verify mọi transition không hợp lệ bị chặn |

---

## 2. Ví Dụ Cụ Thể

### Ví dụ Decision Table (3 điều kiện $\rightarrow$ 1 output):

```markdown
| Rule | Loại KH = VIP | Đơn > 10 triệu | Có mã giảm giá | → Giảm giá |
|---|---|---|---|---|
| R1 | Yes | Yes | Yes | 20% |
| R2 | Yes | Yes | No  | 15% |
| R3 | Yes | No  | -   | 10% |
| R4 | No  | Yes | Yes | 10% |
| R5 | No  | No  | No  | 0%  |
→ Mỗi rule R1-R5 = 1 TC với test data cụ thể
```

### Ví dụ State Transition (Đơn hàng):

```markdown
| Từ \ Đến | Pending | Confirmed | Shipped | Cancelled |
|---|---|---|---|---|
| Draft     | ✅ TC_x | ❌ TC_y (verify chặn) | ❌ | ✅ |
| Pending   | -       | ✅ | ❌ | ✅ |
| Confirmed | ❌      | -  | ✅ | ❌ (verify chặn) |
→ Mỗi ô ✅ và ❌ đều là 1 TC
```
