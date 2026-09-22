import { AppShell } from "@/components/layout/app-shell";
import { requireUser } from "@/lib/auth/dal";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  return (
    <AppShell
      user={{ displayName: user.displayName, username: user.username, role: user.role, modules: user.modules }}
    >
      {children}
    </AppShell>
  );
}
