import { Sidebar } from "@/components/dashboard/Sidebar";
import { NextAuthProvider } from "@/components/auth/NextAuthProvider";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <NextAuthProvider>
      <div className="min-h-screen lg:grid lg:grid-cols-[280px_1fr]">
        <Sidebar />
        <div className="min-w-0">{children}</div>
      </div>
    </NextAuthProvider>
  );
}
