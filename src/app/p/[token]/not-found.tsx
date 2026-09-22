import { LinkBreakIcon } from "@phosphor-icons/react/ssr";
import { Logo } from "@/components/brand/logo";

export default function ParentLinkNotFound() {
  return (
    <main className="mx-auto grid min-h-dvh max-w-md content-center justify-items-center gap-5 px-4 text-center">
      <Logo size={40} withWordmark={false} />
      <LinkBreakIcon weight="duotone" className="size-10 text-muted-foreground" />
      <div className="grid gap-2">
        <h1 className="text-xl font-semibold">Link này không còn dùng được</h1>
        <p className="text-[15px] text-muted-foreground">
          Có thể gia sư đã đổi sang link mới. Hãy nhắn gia sư để nhận link hiện tại.
        </p>
      </div>
    </main>
  );
}
