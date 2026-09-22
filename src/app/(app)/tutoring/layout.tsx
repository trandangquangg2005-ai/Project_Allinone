import { SegmentedNav } from "@/components/ui-kit/segmented-nav";
import { requireModule } from "@/lib/auth/dal";
import { LightboxProvider } from "@/modules/tutoring/components/photo-lightbox";

const TABS = [
  { href: "/tutoring", label: "Chấm công", exact: true },
  { href: "/tutoring/students", label: "Học sinh" },
  { href: "/tutoring/lessons", label: "Buổi học" },
];

export default async function TutoringLayout({ children }: LayoutProps<"/tutoring">) {
  await requireModule("tutoring");
  return (
    <LightboxProvider>
      <div className="grid gap-6">
        <SegmentedNav items={TABS} layoutId="tutoring-tab" />
        {children}
      </div>
    </LightboxProvider>
  );
}
