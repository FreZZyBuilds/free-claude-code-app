import { useState } from "react";
import type { ProviderStatus } from "@/lib/types";
import { cx } from "./ui";

/** Upstream logos use a light currentColor (built for a dark UI), so they always sit on an ink tile. */
export function ProviderLogo({
  provider,
  size = "md",
}: {
  provider: Pick<ProviderStatus, "display_name" | "logo_filename">;
  size?: "sm" | "md" | "lg";
}) {
  const [failed, setFailed] = useState(false);
  const box = size === "sm" ? "size-6 rounded-md p-1" : size === "lg" ? "size-11 rounded-xl p-2" : "size-9 rounded-[10px] p-1.5";
  const initials = provider.display_name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span className={cx("inline-flex shrink-0 items-center justify-center bg-[#1b2436] text-[#e8ecf5]", box)}>
      {provider.logo_filename && !failed ? (
        <img
          src={`/providers/${provider.logo_filename}`}
          alt=""
          className="size-full object-contain"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className={cx("font-semibold", size === "sm" ? "text-[9px]" : "text-xs")}>{initials}</span>
      )}
    </span>
  );
}
