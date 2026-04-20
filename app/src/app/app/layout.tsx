import { Sidebar } from '@/components/Sidebar';
import { AppHeader } from '@/components/AppHeader';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="sable-shell min-h-screen lg:pl-60">
      <div className="sable-grid-overlay" />
      <div className="sable-noise-overlay" />

      <Sidebar />

      <div className="relative z-10 flex min-h-screen flex-col">
        <AppHeader />
        <main className="flex-1 px-4 py-4 md:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
