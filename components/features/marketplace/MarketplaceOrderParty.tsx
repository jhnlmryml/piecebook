import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { getInitials } from "@/lib/get-initials";

type MarketplaceOrderPartyProps = {
  label: string;
  id: string;
  name: string;
  role: string | null;
  location: string | null;
  image: string | null;
};

export function MarketplaceOrderParty({
  label,
  id,
  name,
  role,
  location,
  image,
}: MarketplaceOrderPartyProps) {
  return (
    <Card className="rounded-xl border-border/70 bg-muted/20 p-3 shadow-none sm:p-4">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <div className="flex min-w-0 items-center gap-2.5">
        <Avatar className="size-10 shrink-0">
          <AvatarImage src={image ?? undefined} alt="" />
          <AvatarFallback className="bg-primary/10 text-primary">
            {getInitials(name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {role || label} · {location || "Location not provided"}
          </p>
          <p className="truncate text-[10px] text-muted-foreground">
            Profile ID: {id}
          </p>
        </div>
      </div>
    </Card>
  );
}
