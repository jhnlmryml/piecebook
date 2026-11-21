"use client";

import { useEffect, useState, type ComponentProps } from "react";

type LocalDateTimeProps = Omit<ComponentProps<"time">, "dateTime"> & {
  dateTime: string;
};

export function LocalDateTime({ dateTime, ...props }: LocalDateTimeProps) {
  const [formatted, setFormatted] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;

      const date = new Date(dateTime);
      setFormatted(
        Number.isNaN(date.getTime())
          ? ""
          : new Intl.DateTimeFormat(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(date),
      );
    });

    return () => {
      active = false;
    };
  }, [dateTime]);

  return (
    <time dateTime={dateTime} {...props}>
      {formatted ?? "\u00a0"}
    </time>
  );
}
