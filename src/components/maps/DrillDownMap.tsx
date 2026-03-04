"use client";

import dynamic from "next/dynamic";

const DrillDownMapInner = dynamic(() => import("./DrillDownMapInner"), {
  ssr: false,
  loading: () => <div className="skeleton w-full h-full rounded-xl" />,
});

export default function DrillDownMap({ height = "100%" }: { height?: string }) {
  return <DrillDownMapInner height={height} />;
}
