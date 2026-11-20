"use client";

import { useEffect, useState } from "react";
import { PackageSearch } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getInitials } from "@/lib/get-initials";
import {
  formatPrice,
  getMarketplaceOrderRecords,
  parseCategoryDetails,
  type MarketplaceOrder,
} from "./marketplace-data";

type MarketplaceOrderHistoryProps = {
  profileId: string;
  role: "buyer" | "seller";
};

export function MarketplaceOrderHistory({
  profileId,
  role,
}: MarketplaceOrderHistoryProps) {
  const [records, setRecords] = useState<MarketplaceOrder[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let active = true;
    void getMarketplaceOrderRecords(profileId, role)
      .then((orders) => {
        if (active) setRecords(orders);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Could not load order history.");
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [profileId, reloadCount, role]);

  const heading = role === "buyer" ? "Purchase history" : "Sales history";

  return (
    <main className="flex h-full min-h-0 flex-col bg-background px-3 pt-4 sm:px-5 lg:px-6 lg:pt-5 xl:px-8">
      <header className="mb-5 shrink-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Marketplace</p>
        <h1 className="mt-1 text-2xl font-bold leading-tight tracking-tight sm:text-3xl">{heading}</h1>
        <p className="mt-1 text-sm text-muted-foreground">A record of every order, independent of the current listing.</p>
      </header>

      <section className="min-h-0 flex-1 overflow-y-auto pb-10" aria-label={heading}>
        {isLoading ? (
          <div className="space-y-3" aria-busy="true">
            {Array.from({ length: 3 }, (_, index) => (
              <Card key={index} className="h-28 animate-pulse rounded-sm border-border bg-card shadow-none" />
            ))}
          </div>
        ) : error ? (
          <Card className="rounded-sm border border-border bg-card px-5 py-12 text-center shadow-none ring-0">
            <h2 className="text-lg font-bold">{heading} could not load</h2>
            <p className="mx-auto mt-1 max-w-lg text-sm text-muted-foreground">{error}</p>
            <Button
              type="button"
              variant="link"
              onClick={() => {
                setIsLoading(true);
                setError(null);
                setReloadCount((count) => count + 1);
              }}
              className="mt-4"
            >
              Try again
            </Button>
          </Card>
        ) : records.length === 0 ? (
          <Card className="rounded-sm border border-border bg-card px-5 py-12 text-center shadow-none ring-0">
            <PackageSearch className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
            <h2 className="mt-3 text-lg font-bold">No orders yet</h2>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              {role === "buyer"
                ? "Items you check out will appear here."
                : "Orders for your listings will appear here."}
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {records.map((record) => (
              <Card key={record.id} className="rounded-sm border border-border bg-card p-4 shadow-none ring-0 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Order placed</p>
                    <h2 className="mt-1 wrap-break-word text-base font-bold">
                      <Link href={`/marketplace/items/${record.id}`} className="underline-offset-4 hover:text-primary hover:underline">
                        {record.listing_title}
                      </Link>
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">Order #{record.id.slice(0, 8)}</p>
                  </div>
                  <time className="shrink-0 text-xs text-muted-foreground" dateTime={record.created_at}>
                    {new Date(record.created_at).toLocaleString()}
                  </time>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <OrderPartyCard
                    label="Buyer"
                    id={record.buyer_id}
                    name={record.buyer_name}
                    role={record.buyer_role}
                    location={record.buyer_location}
                    image={record.buyer_image}
                  />
                  <OrderPartyCard
                    label="Seller"
                    id={record.seller_id}
                    name={record.seller_name}
                    role={record.seller_role}
                    location={record.seller_location}
                    image={record.seller_image}
                  />
                </div>
                <div className="mt-4 flex gap-3 border-t border-border pt-4">
                  {record.listing_photos[0] && (
                    <Link
                      href={`/marketplace/items/${record.id}`}
                      aria-label={`View sold item: ${record.listing_title}`}
                      className="relative size-20 shrink-0 overflow-hidden rounded-sm bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Image src={record.listing_photos[0]} alt="" fill unoptimized className="object-cover" />
                    </Link>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">
                      {record.quantity} × {formatPrice(Number(record.unit_price))}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {record.listing_category} · {record.listing_condition} · {record.listing_location}
                    </p>
                    <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs text-muted-foreground">
                      {record.listing_description}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-bold">Total {formatPrice(Number(record.total_price))}</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {Object.entries(parseCategoryDetails(record.listing_category_details)).map(([label, value]) => (
                    <span key={label}>{label}: {value}</span>
                  ))}
                </div>
                <div className="mt-3 border-t border-border pt-3">
                  <Link href={`/marketplace/orders/${record.id}`} className="text-xs font-semibold text-primary underline-offset-4 hover:underline">
                    Full order record
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function OrderPartyCard({
  label,
  id,
  name,
  role,
  location,
  image,
}: {
  label: string;
  id: string;
  name: string;
  role: string | null;
  location: string | null;
  image: string | null;
}) {
  return (
    <Card className="rounded-sm p-3 shadow-none ring-0">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="flex min-w-0 items-center gap-2.5">
        <Avatar>
          <AvatarImage src={image ?? undefined} alt="" />
          <AvatarFallback>{getInitials(name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{name}</p>
          <p className="truncate text-xs text-muted-foreground">{role || label} · {location || "Location not provided"}</p>
          <p className="truncate text-[10px] text-muted-foreground">Profile ID: {id}</p>
        </div>
      </div>
    </Card>
  );
}
