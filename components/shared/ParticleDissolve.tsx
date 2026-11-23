"use client";

import { useEffect, useRef, type ReactNode } from "react";

type ParticleDissolveProps = {
  children: ReactNode;
  isExiting: boolean;
  onExitComplete: () => void;
  particleCount?: number;
  className?: string;
};

export function ParticleDissolve({
  children,
  isExiting,
  onExitComplete,
  particleCount: _particleCount = 200,
  className,
}: ParticleDissolveProps) {
  const completedRef = useRef(false);
  void _particleCount;

  useEffect(() => {
    if (isExiting && !completedRef.current) {
      completedRef.current = true;
      onExitComplete();
    }
    if (!isExiting) completedRef.current = false;
  }, [isExiting, onExitComplete]);

  return <div className={`relative ${className ?? ""}`}>{children}</div>;
}

export function ParticleBurst({
  children,
  isExiting,
  particleCount: _particleCount = 500,
  className,
}: {
  children: ReactNode;
  isExiting: boolean;
  particleCount?: number;
  className?: string;
}) {
  void isExiting;
  void _particleCount;
  return <div className={`relative inline-flex max-w-full ${className ?? ""}`}>{children}</div>;
}
