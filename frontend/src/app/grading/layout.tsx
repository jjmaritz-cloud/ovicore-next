import type { ReactNode } from "react";
import GradingSidebar from "./sidebar";
export default function GradingLayout({ children }: { children: ReactNode }) {
  return <><GradingSidebar /><div className="grading-content">{children}</div></>;
}
