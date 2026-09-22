export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      {/* Two soft light spots in the logo colours; fixed and non-interactive. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-70 dark:opacity-40"
        style={{
          background:
            "radial-gradient(40rem 28rem at 12% 8%, color-mix(in oklch, var(--brand-blue) 12%, transparent), transparent 70%), radial-gradient(36rem 26rem at 92% 96%, color-mix(in oklch, var(--brand-green) 12%, transparent), transparent 70%)",
        }}
      />
      <div className="relative w-full max-w-[400px]">{children}</div>
    </main>
  );
}
