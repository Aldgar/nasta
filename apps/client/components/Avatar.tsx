"use client";
import { useState } from "react";

interface AvatarProps {
  src: string | null | undefined;
  alt?: string;
  fallback: React.ReactNode;
  imgClassName?: string;
}

export default function Avatar({
  src,
  alt = "",
  fallback,
  imgClassName,
}: AvatarProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return <>{fallback}</>;
  }

  return (
    <img
      src={src}
      alt={alt}
      className={imgClassName}
      onError={() => setFailed(true)}
    />
  );
}
