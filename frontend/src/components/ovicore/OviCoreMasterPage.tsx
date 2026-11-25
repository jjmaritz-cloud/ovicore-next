"use client";

import type { ReactNode } from "react";
import OviCoreShell from "@/components/ovicore/OviCoreShell";
import OviCoreModuleHeader, { type HeaderAction } from "@/components/OviCoreModuleHeader";
import type { OviCoreModule } from "@/components/sidebar/OviCoreSidebar.types";
import styles from "./OviCoreMasterPage.module.css";

type Props = {
  module: OviCoreModule;
  eyebrow: string;
  title: string;
  description: string;
  actions?: HeaderAction[];
  children: ReactNode;
};

/** Shared desktop frame; opt-in until pilot approval. */
export default function OviCoreMasterPage({ module, eyebrow, title, description, actions, children }: Props) {
  return (
    <OviCoreShell module={module} masterPilot>
      <div className={styles.frame}>
        <OviCoreModuleHeader compact eyebrow={eyebrow} title={title} description={description} actions={actions} />
        <div className={styles.content}>{children}</div>
      </div>
    </OviCoreShell>
  );
}
