import BreederSidebar from "./BreederSidebar";

export default function BreederLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="breeder-layout">
      <BreederSidebar />

      <div className="breeder-content">{children}</div>

      <style>{`
        .breeder-layout {
          min-height: 100vh;
          background: #f6fbf8;
        }

        .breeder-content {
          min-width: 0;
          padding-left: 42px;
        }

        @media (max-width: 900px) {
          .breeder-content {
            padding-left: 0;
          }
        }
      `}</style>
    </div>
  );
}