
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ExternalLink } from "lucide-react";
import { PORTFOLIO_WORKS } from "@/data/portfolio-works";
import AppHeader from "@/components/layout/AppHeader";
import ProfileCard from "@/components/features/profile/ProfileCard";
import WallFeed from "@/components/features/posts/WallFeed";

function DesktopPreview({
  url,
  title,
  onLoad,
}: {
  url: string;
  title: string;
  onLoad: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(([entry]) => {
      setScale(entry.contentRect.width / 1280);
    });

    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative aspect-video w-full overflow-hidden bg-white"
    >
      {/* Keep live previews intact while preventing autoplay in this frame and nested frames. */}
      <iframe
        src={url}
        title={`${title} live preview`}
        loading="lazy"
        tabIndex={-1}
        inert
        aria-hidden="true"
        onLoad={onLoad}
        referrerPolicy="strict-origin-when-cross-origin"
        allow="autoplay 'none'"
        sandbox="allow-forms allow-popups allow-same-origin allow-scripts"
        style={{
          width: "1280px",
          height: "720px",
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          visibility: scale > 0 ? "visible" : "hidden",
        }}
        className="pointer-events-none absolute left-0 top-0 border-0 bg-white"
      />
    </div>
  );
}

export default function HomePage() {
  const [searchTerm, setSearchTerm] = useState("");

  const portfolioScrollRef = useRef<HTMLDivElement>(null);
  const savedScrollTop = useRef(0);
  const isUserScrolling = useRef(false);
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleUserScroll = useCallback(() => {
    isUserScrolling.current = true;

    if (scrollTimeout.current) {
      clearTimeout(scrollTimeout.current);
    }

    scrollTimeout.current = setTimeout(() => {
      isUserScrolling.current = false;
    }, 200);
  }, []);

  const handlePortfolioScroll = useCallback(() => {
    if (isUserScrolling.current && portfolioScrollRef.current) {
      savedScrollTop.current = portfolioScrollRef.current.scrollTop;
    }
  }, []);

  const restorePortfolioScroll = useCallback(() => {
    requestAnimationFrame(() => {
      if (portfolioScrollRef.current) {
        portfolioScrollRef.current.scrollTop = savedScrollTop.current;
      }
    });
  }, []);

  useEffect(() => {
    return () => {
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
    };
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <AppHeader
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
      />

      <main className="mx-auto grid min-h-0 w-full max-w-6xl flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)] gap-4 overflow-hidden px-3 py-4 sm:px-5 sm:py-6 md:grid-cols-[minmax(210px,0.8fr)_minmax(0,1.8fr)] md:gap-5 xl:grid-cols-[230px_minmax(0,1fr)_260px] xl:gap-6 xl:py-8">

        <aside
          className="hidden min-h-0 min-w-0 md:block"
          id="profile"
          aria-label="Your profile"
        >
          <ProfileCard />
        </aside>

        <section
          className="flex min-h-0 min-w-0 flex-col"
          aria-label="Your wall"
        >
          <WallFeed searchTerm={searchTerm} />
        </section>

        <aside
          className="hidden min-h-0 min-w-0 xl:order-3 xl:block"
          aria-label="Other work portfolio"
          id="portfolio"
        >
          <section className="piecebook-card-surface flex h-full min-h-0 flex-col overflow-hidden rounded-sm border">

            <header className="piecebook-divider piecebook-secondary-surface shrink-0 border-b px-3 py-2.5">
              <p className="piecebook-muted-text text-[10px] font-semibold uppercase tracking-wider">
                Advertise
              </p>

              <h2 className="piecebook-brand-text mt-0.5 text-sm font-bold">
                More of my work
              </h2>
            </header>

            <div
              ref={portfolioScrollRef}
              onWheel={handleUserScroll}
              onTouchMove={handleUserScroll}
              onScroll={handlePortfolioScroll}
              className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain [overflow-anchor:none] p-3 scrollbar-hide"
            >
              {PORTFOLIO_WORKS.map((work) => (
                <article
                  key={work.url}
                  className="overflow-hidden rounded-sm border border-border bg-background"
                >
                  {/* Browser window */}
                  <div className="overflow-hidden rounded-t-sm bg-[#111318]">

                    {/* Browser toolbar */}
                    <div className="flex h-9 items-center gap-3 border-b border-white/10 px-3">

                      <div className="flex shrink-0 items-center gap-1.5">
                        <span className="size-2.5 rounded-full bg-[#ff5f57]" />
                        <span className="size-2.5 rounded-full bg-[#febc2e]" />
                        <span className="size-2.5 rounded-full bg-[#28c840]" />
                      </div>

                      <div className="flex h-5 min-w-0 flex-1 items-center rounded-sm bg-white/10 px-2">
                        <span className="truncate text-[9px] text-white/50">
                          {work.url}
                        </span>
                      </div>

                      <a
                        href={work.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Open ${work.title} in a new tab`}
                        className="shrink-0 text-white/60 hover:text-white"
                      >
                        <ExternalLink
                          aria-hidden="true"
                          className="size-3.5"
                        />
                      </a>
                    </div>

                    {"preview" in work && work.preview === "static" ? (
                      <div className="flex aspect-video w-full flex-col items-center justify-center gap-1 bg-[#111318] text-center text-white">
                        <p className="text-xs font-semibold">Preview disabled</p>
                        {/* <p className="text-[10px] text-white/60">Open the project to play</p> */}
                      </div>
                    ) : (
                      <DesktopPreview
                        url={work.url}
                        title={work.title}
                        onLoad={restorePortfolioScroll}
                      />
                    )}

                  </div>

                  {/* Project details */}
                  <div className="p-2.5">

                    <div className="flex items-start justify-between gap-2">
                      <h3 className="piecebook-brand-text text-xs font-bold">
                        {work.title}
                      </h3>
                    </div>

                    <p className="piecebook-muted-text mt-1 text-xs leading-relaxed">
                      {work.description}
                    </p>

                    <p className="piecebook-muted-text mt-2 text-[10px] leading-relaxed">
                      <span className="font-semibold text-foreground">
                        Stack:
                      </span>{" "}
                      {work.stack}
                    </p>

                  </div>
                </article>
              ))}
            </div>
          </section>
        </aside>
      </main>
    </div>
  );
}
