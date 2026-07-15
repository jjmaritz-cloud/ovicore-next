type OviCoreBrandIconProps = {
  variant?: "orange" | "white";
  size?: "small" | "medium" | "large";
  className?: string;
};

export default function OviCoreBrandIcon({
  variant = "orange",
  size = "medium",
  className = "",
}: OviCoreBrandIconProps) {
  return (
    <span
      className={[
        "ovicore-brand-icon",
        `ovicore-brand-icon-${variant}`,
        `ovicore-brand-icon-${size}`,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-hidden="true"
    >
      <span className="ovicore-brand-icon-ring" />
    </span>
  );
}