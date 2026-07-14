"use client";

type OviCoreActionBarProps = {
  left?: React.ReactNode;
  right?: React.ReactNode;
};

export default function OviCoreActionBar({
  left,
  right,
}: OviCoreActionBarProps) {
  return (
    <div className="ovicore-action-bar">
      <div className="ovicore-action-left">{left}</div>
      <div className="ovicore-action-right">{right}</div>
    </div>
  );
}