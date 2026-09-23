import { CloudSlashIcon } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { Logo } from "@/components/brand/logo";

export const metadata: Metadata = { title: "Ngoại tuyến" };

/**
 * Shown only when a page is opened for the first time with no connection.
 * Pages already visited come from the service worker cache instead.
 */
export default function OfflinePage() {
  return (
    <div className="grid min-h-dvh place-items-center px-6 py-10">
      <div className="grid max-w-sm justify-items-center gap-4 text-center">
        <Logo size={34} />
        <span className="hex grid size-14 place-items-center bg-muted">
          <CloudSlashIcon className="size-7 text-muted-foreground" />
        </span>
        <h1 className="text-xl font-semibold">Chưa mở được trang này</h1>
        <p className="text-sm text-muted-foreground">
          Máy đang không có mạng và trang này chưa từng được tải về. Những trang bạn đã xem vẫn mở bình thường, và mọi thứ bạn nhập sẽ
          được gửi đi khi có mạng trở lại.
        </p>
      </div>
    </div>
  );
}
