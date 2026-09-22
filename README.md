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
