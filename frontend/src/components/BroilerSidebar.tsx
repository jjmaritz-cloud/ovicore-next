"use client";

import { usePathname, useRouter } from "next/navigation";

const broilerMenuItems = [
	{
		label: "Home",
		href: "/broilers",
	},
  {
    label: "Demand Planner",
    href: "/broilers/demand-planner",
  },
  {
    label: "Farm Register",
    href: "/broilers/farms",
  },
  {
    label: "Shed Register",
    href: "/broilers/sheds",
  },
  {
    label: "Cycle Register",
    href: "/broilers/cycles",
  },
  {
    label: "Daily House Sheet",
    href: "/broilers/performance",
  },
  {
    label: "Processing",
    href: "/broilers/processing",
  },
	{
		label: "Notes",
		href: "/broilers/notes",
	},
];

export default function BroilerSidebar() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="brand-row">
        <div className="brand-logo">
          <img src="/OviCore_egg_icon.png" alt="OviCore" />
        </div>

        <div>
          <h1>OviCore</h1>
          <p>Plan with confidence. Forecast with precision.</p>
        </div>
      </div>

      <div className="workspace-card">
        <span>Active workspace</span>
        <strong>Broiler Operations</strong>

        <div className="workspace-pills">
          <b>Broilers</b>
          <b>Performance</b>
          <b>Daily</b>
        </div>
      </div>

      <nav className="nav-list">
        {broilerMenuItems.map((item) => (
          <button
            key={item.href}
            type="button"
            className={pathname === item.href ? "active" : ""}
            onClick={() => router.push(item.href)}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}