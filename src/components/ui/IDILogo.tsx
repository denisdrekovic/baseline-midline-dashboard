"use client";

import Image from "next/image";

interface IDILogoProps {
  size?: number;
  className?: string;
}

/**
 * Institute for Development Impact (IDI) logo mark.
 * Uses the actual IDI chevron PNG asset.
 */
export default function IDILogo({ size = 24, className = "" }: IDILogoProps) {
  return (
    <Image
      src="/idi-logo.png"
      alt=""
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      style={{ objectFit: "contain" }}
      priority
    />
  );
}
