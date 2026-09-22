import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/dal";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Đăng nhập" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  // Validated against the database, so a stale cookie never loops.
  if (await getCurrentUser()) redirect("/");
  const { next } = await searchParams;
  return <LoginForm next={typeof next === "string" ? next : "/"} />;
}
