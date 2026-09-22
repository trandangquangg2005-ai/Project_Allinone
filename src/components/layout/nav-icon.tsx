import {
  ChalkboardTeacherIcon,
  GearSixIcon,
  HouseSimpleIcon,
  ShieldCheckIcon,
  WalletIcon,
} from "@phosphor-icons/react/ssr";
import type { IconWeight } from "@phosphor-icons/react";
import type { NavIconKey } from "./nav-items";

const ICONS = {
  home: HouseSimpleIcon,
  finance: WalletIcon,
  tutoring: ChalkboardTeacherIcon,
  admin: ShieldCheckIcon,
  settings: GearSixIcon,
} satisfies Record<NavIconKey, unknown>;

export function NavIcon({ icon, weight, className }: { icon: NavIconKey; weight?: IconWeight; className?: string }) {
  const Icon = ICONS[icon];
  return <Icon weight={weight} className={className} />;
}
