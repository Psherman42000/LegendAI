import { Sidebar } from "@/components/dashboard/Sidebar";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[280px_1fr]">
      <Sidebar />
      <div className="min-w-0 px-4 py-6 md:px-6 md:py-8 lg:p-10">{children}</div>
    </div>
  );
}
