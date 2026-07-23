import type { ReactNode } from "react";

export type DailyHouseCardTone = "neutral" | "good" | "warning" | "bad";

export type DailyHouseCardKpi = {
  label: string;
  value: ReactNode;
  helper?: ReactNode;
  tone?: DailyHouseCardTone;
};

export type DailyHouseCardFooterItem = {
  label: string;
  value: ReactNode;
};

export type DailyHouseCardAction = {
  label: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary";
};

export type DailyHouseCardProps = {
  moduleLabel: string;
  description: string;
  selectorLabel: string;
  selector: ReactNode;
  kpis: DailyHouseCardKpi[];
  tableDescription: string;
  tableSummary?: ReactNode;
  message?: ReactNode;
  homeAction?: DailyHouseCardAction;
  secondaryAction?: DailyHouseCardAction;
  onSave?: () => void;
  onDiscard?: () => void;
  saveDisabled?: boolean;
  discardDisabled?: boolean;
  saving?: boolean;
  unsavedCount?: number;
  footerItems?: DailyHouseCardFooterItem[];
  children: ReactNode;
};
