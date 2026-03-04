interface SkeletonProps {
  className?: string;
  height?: string;
}

export default function Skeleton({ className = "", height = "1rem" }: SkeletonProps) {
  return (
    <div
      className={`skeleton w-full ${className}`}
      style={{ height }}
    />
  );
}
