"use client";

import { useEffect, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

type ParticleDissolveProps = {
  children: ReactNode;
  isExiting: boolean;
  onExitComplete: () => void;
  particleCount?: number;
  className?: string;
};

type ParticleFieldProps = {
  count: number;
  reducedMotion: boolean;
};

function randomValue(seed: number) {
  const value = Math.sin((seed + 1) * 127.1) * 43758.5453;
  return value - Math.floor(value);
}

function ParticleField({ count, reducedMotion }: ParticleFieldProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setIsAnimating(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-visible">
      {Array.from({ length: count }, (_, index) => {
        const angle = randomValue(index + 11) * Math.PI * 2;
        const distance = reducedMotion ? 0 : 18 + randomValue(index + 29) * 52;
        const driftX = Math.cos(angle) * distance;
        const driftY = Math.sin(angle) * distance - randomValue(index + 43) * 16;
        const stagger = randomValue(index + 61) * (reducedMotion ? 0.02 : 0.18);
        const particleDuration = reducedMotion
          ? 0.5
          : 0.82 + randomValue(index + 79) * 0.22;

        return (
          <motion.span
            key={index}
            aria-hidden="true"
            initial={false}
            animate={
              isAnimating
                ? {
                    x: driftX,
                    y: driftY,
                    opacity: [0, 1, 0],
                    scale: [0, 1, 0.15],
                  }
                : { x: 0, y: 0, opacity: 0, scale: 0 }
            }
            transition={{
              duration: particleDuration,
              delay: stagger,
              ease: "easeOut",
            }}
            style={{
              left: `${randomValue(index + 101) * 100}%`,
              top: `${randomValue(index + 131) * 100}%`,
              width: 2 + randomValue(index + 157) * 2,
              height: 2 + randomValue(index + 181) * 2,
            }}
            className={`absolute rounded-[1px] ${
              index % 5 === 0
                ? "bg-foreground"
                : index % 3 === 0
                  ? "bg-primary/70"
                  : "bg-primary"
            }`}
          />
        );
      })}
    </div>
  );
}

export function ParticleDissolve({
  children,
  isExiting,
  onExitComplete,
  particleCount = 200,
  className,
}: ParticleDissolveProps) {
  const prefersReducedMotion = useReducedMotion();
  const duration = prefersReducedMotion ? 0.62 : 1.45;

  return (
    <motion.div
      layout={!prefersReducedMotion}
      animate={isExiting ? "exit" : "visible"}
      variants={{
        visible: { height: "auto" },
        exit: {
          height: 0,
          transition: { height: { duration, ease: "easeInOut" } },
        },
      }}
      onAnimationComplete={(definition) => {
        if (isExiting && definition === "exit") onExitComplete();
      }}
      aria-hidden={isExiting || undefined}
      inert={isExiting}
      className={`relative ${className ?? ""} ${isExiting ? "pointer-events-none" : ""}`}
    >
      <motion.div
        animate={
          isExiting
            ? {
                opacity: 0,
                scale: prefersReducedMotion ? 1 : 0.97,
                filter: prefersReducedMotion ? "blur(0px)" : "blur(5px)",
              }
            : { opacity: 1, scale: 1, filter: "blur(0px)" }
        }
        transition={{ duration, ease: "easeOut" }}
        className="relative"
      >
        {children}
      </motion.div>
      {isExiting && !prefersReducedMotion && particleCount > 0 && (
        <ParticleField
          count={particleCount}
          reducedMotion={false}
        />
      )}
    </motion.div>
  );
}

export function ParticleBurst({
  children,
  isExiting,
  particleCount = 500,
  className,
}: {
  children: ReactNode;
  isExiting: boolean;
  particleCount?: number;
  className?: string;
}) {
  const prefersReducedMotion = useReducedMotion();
  const count = prefersReducedMotion
    ? Math.min(particleCount, 24)
    : particleCount;

  return (
    <div className={`relative inline-flex max-w-full ${className ?? ""}`}>
      <motion.div
        animate={
          isExiting
            ? {
                opacity: 0,
                scale: prefersReducedMotion ? 1 : 0.97,
                filter: prefersReducedMotion ? "blur(0px)" : "blur(5px)",
              }
            : { opacity: 1, scale: 1, filter: "blur(0px)" }
        }
        transition={{
          duration: prefersReducedMotion ? 0.4 : 0.9,
          ease: "easeInOut",
        }}
        className="relative w-full max-w-full"
      >
        {children}
      </motion.div>
      {isExiting && count > 0 && (
        <ParticleField
          count={count}
          reducedMotion={Boolean(prefersReducedMotion)}
        />
      )}
    </div>
  );
}
