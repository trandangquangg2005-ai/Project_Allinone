# AIO

Ứng dụng web cá nhân "tất cả trong một", dùng tốt trên điện thoại (cài được như app) và máy tính.

- **Tài chính:** thu chi theo nhiều ví, chuyển tiền giữa ví, khoản nợ cần đòi và phải trả (trả từng phần, nhắc nợ qua Zalo), báo cáo hằng tháng.
- **Gia sư:** học sinh và học phí mỗi buổi, chấm công bằng ảnh lúc check-in/check-out (giờ lấy theo máy chủ), thu học phí (tự ghi vào Tài chính), link riêng cho phụ huynh xem buổi học, ảnh và học phí, kèm mã VietQR.
- **Tài khoản:** quản trị viên tạo tài khoản và bật tắt từng chức năng. Dữ liệu mỗi tài khoản tách riêng hoàn toàn.

## Công nghệ

Next.js 16 (App Router, TypeScript), React 19, Tailwind CSS 4, shadcn/ui, Motion, Phosphor Icons, Drizzle ORM + `pg` trên Neon Postgres, Vercel Blob (private), triển khai trên Vercel (region `sin1`).

## Cách dữ liệu được tách giữa các tài khoản

1. Mọi bảng dữ liệu có cột `user_id`. Mọi truy vấn chạy trong `withTenant(userId, tx => …)` (`src/db/index.ts`), vừa lọc theo `user_id` vừa đặt `app.user_id` cho Postgres.
2. Postgres **Row-Level Security** bật trên mọi bảng dữ liệu (`src/db/schema/_policies.ts`). App kết nối bằng role `aio_app` không có quyền BYPASSRLS, nên kể cả khi code quên điều kiện, DB vẫn chỉ trả dữ liệu của đúng tài khoản.
3. Khóa ngoại dạng `(user_id, id)` chặn việc trỏ sang dữ liệu của tài khoản khác.
4. Link phụ huynh chỉ lưu hash của token; khi mở link, RLS giới hạn đúng một học sinh.
5. Quyền dùng chức năng được kiểm tra ở mọi trang **và** mọi Server Action (`src/lib/action.ts`).

`tests/rls.integration.test.ts` chạy trên DB thật để chứng minh các điều trên.

## Quản trị viên xem dữ liệu tài khoản khác

Trang **Quản trị** có nút **Mở dữ liệu** ở mỗi tài khoản. Bấm vào, admin xem và sửa được toàn bộ dữ liệu của tài khoản đó trong 4 giờ, đúng như người dùng đó thấy (RLS chạy với `user_id` của họ).

- Một dải màu hổ phách luôn hiện trên đầu màn hình, kèm nút **Thoát**.
- Mọi thao tác ghi trong lúc này được lưu vào bảng `audit_log` (ai, tài khoản nào, làm gì, lúc nào) và hiện ở cuối trang Quản trị. Nhật ký tự xóa sau 90 ngày.
- Vé "xem như" nằm trong cookie `aio_view_as`, có chữ ký và gắn với đúng admin đã tạo nó; đăng xuất hoặc đăng nhập lại là mất hiệu lực.

## Dùng khi không có mạng

- **Xem:** service worker (`public/sw.js`) giữ lại những trang đã mở, ảnh chấm công và toàn bộ giao diện. Trang chưa từng mở sẽ hiện `/offline`.
- **Ghi:** mọi thao tác lưu/sửa/xóa đi qua `src/modules/*/offline-actions.ts`. Khi không gửi được, thao tác (kèm ảnh) nằm trong IndexedDB và hiện ở nút trạng thái góc màn hình.
- **Gửi lại:** khi có mạng, có thể quay lại tab, hoặc ngay sau một thao tác mới, cả hàng đợi được gửi trong **một** request tới `/api/sync`. Không có vòng lặp hỏi server định kỳ.
- Mỗi thao tác mang một id riêng; server ghi nhận id đó trước khi thực hiện, nên gửi lại lần hai không tạo bản ghi trùng.
- Buổi dạy check-in lúc mất mạng vẫn hiện "Đang dạy" kèm ảnh; check-out gắn với buổi đó qua `checkInRequestId`, và giờ ghi nhận là giờ thật lúc dạy, không phải lúc đồng bộ.

## Giữ trong hạn mức miễn phí

Neon free: **512 MB** dữ liệu, **100 CU-hours**/tháng (≈400 giờ thức ở 0.25 CU), tự ngủ sau 5 phút. Vercel Hobby: 100 GB băng thông, **10 GB** Fast Origin Transfer, 1M lượt gọi. Blob Hobby: **1 GB**, **2.000** lượt ghi và **10.000** lượt đọc/tháng.

Những gì app đang làm để ở trong ngưỡng đó:

- Ảnh nén WebP ≤1280px (~10 KB/ảnh). 100 buổi/tháng ≈ 200 ảnh ≈ 2 MB và 200/2.000 lượt ghi Blob.
- Ảnh được đánh dấu bất biến và cache ở máy, nên xem lại không tốn thêm lượt đọc Blob hay băng thông.
- Ảnh tải lên **trước** khi mở transaction: Neon tính "idle in transaction" là compute đang chạy.
- Pool tối đa 3 kết nối mỗi instance.
- Không có cron, không có polling. Đồng bộ chỉ chạy khi có sự kiện, và giãn dần tới 8 phút nếu server không trả lời.
- `audit_log` tự dọn sau 90 ngày, `sync_ops` sau 30 ngày.
- Xem dung lượng đang dùng ở cuối trang **Quản trị**.

## Chạy trên máy

Cần Node.js 22+.

```bash
npm install
cp .env.example .env.local   # điền DATABASE_URL_OWNER và AUTH_SECRET
npm run db:setup             # tạo role aio_app, ghi DATABASE_URL vào .env.local
npm run db:migrate           # tạo bảng
npm run db:seed-admin -- --username admin --name "Tên của bạn"   # in mật khẩu tạm
npm run dev                  # http://localhost:3000
```

Khi chưa có `BLOB_READ_WRITE_TOKEN`, ảnh chấm công được lưu vào thư mục `.uploads/` trên máy.

| Lệnh | Việc |
|---|---|
| `npm run dev` | Chạy dev server |
| `npm run build` | Build production |
| `npm run lint` / `npm run typecheck` | Kiểm tra code |
| `npm test` | Unit test + test cách ly dữ liệu trên Neon |
| `npm run db:generate` | Sinh migration sau khi sửa `src/db/schema` |
| `npm run db:migrate` | Áp migration (dùng `DATABASE_URL_OWNER`) |
| `npm run db:setup` | Tạo/cập nhật role `aio_app` và quyền |
| `npm run db:seed-admin` | Tạo tài khoản quản trị đầu tiên |
| `npm run icons` | Sinh lại favicon/icon app từ `public/brand/*.svg` |

## Triển khai lên Vercel

1. Vercel → **Add New… → Project** → import repo này. Framework: Next.js (tự nhận).
2. **Environment Variables** (Production và Preview):
   - `DATABASE_URL`: lấy từ `.env.local` (role `aio_app`, host `-pooler`).
   - `AUTH_SECRET`: lấy từ `.env.local`.
   - **Không** thêm `DATABASE_URL_OWNER` lên Vercel.
3. Deploy.
4. Project → **Storage → Create → Blob**, chọn **Private**, region gần Việt Nam (Singapore), rồi **Connect** vào project. Vercel tự thêm thông tin xác thực. Sau đó **Redeploy**.
5. Mở trang production, đăng nhập bằng tài khoản admin và đặt mật khẩu mới.

Region của Functions được đặt là `sin1` trong `vercel.ts`, cùng khu vực với Neon.

## Thêm một chức năng (module) mới

1. Khai báo trong `src/config/modules.ts`.
2. Tạo route `src/app/(app)/<ten-module>/` với `layout.tsx` gọi `requireModule("<key>")`.
3. Bảng mới: thêm `user_id` + `tenantPolicy()` + khóa ngoại `(user_id, id)`; chạy `npm run db:generate` rồi `npm run db:migrate`.
4. Server Action: dùng `createAction({ module: "<key>" }, schema, handler)`.
5. Bật module cho tài khoản trong trang Quản trị.
