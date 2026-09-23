import { AppShell } from "@/components/layout/app-shell";
import { OfflineProvider } from "@/components/offline/offline-provider";
import { requireUser } from "@/lib/auth/dal";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  return (
    <AppShell
      user={{ displayName: user.displayName, username: user.username, role: user.role, modules: user.modules }}
      viewingAs={user.actor ? { username: user.username, adminName: user.actor.username } : null}
    >
      {children}
      <OfflineProvider userId={user.id} />
    </AppShell>
  );
}
