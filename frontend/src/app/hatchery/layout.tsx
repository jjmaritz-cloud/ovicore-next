import HatcherySidebar from "./HatcherySidebar";

export default function HatcheryLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="hatchery-layout">
      <HatcherySidebar />

      <div className="hatchery-content">{children}</div>

      <style>{`
        .hatchery-layout {
          min-height: 100vh;
          background: #f6fbf8;
        }

        .hatchery-content {
          min-width: 0;
          padding-left: 42px;
        }

        @media (max-width: 900px) {
          .hatchery-content {
            padding-left: 0;
          }
        }
      `}</style>
    </div>
  );
}