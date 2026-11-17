import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function ProfileSkeleton() {
    return (
        <>
            <Card className="piecebook-card-surface gap-0 rounded-sm border py-0 shadow-none md:hidden">
                <CardContent className="flex items-center gap-3 p-3">
                    <Skeleton className="size-12 shrink-0 rounded-sm" />
                    <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                    </div>
                </CardContent>
            </Card>
            <div className="hidden space-y-4 md:block">
                <Card className="piecebook-card-surface gap-0 rounded-sm border py-0 shadow-none">
                    <CardContent className="space-y-2 p-3">
                        <Skeleton className="aspect-square w-full rounded-sm" />
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-20" />
                    </CardContent>
                </Card>
                <Card className="piecebook-card-surface gap-0 rounded-sm border py-0 shadow-none">
                    <CardHeader className="piecebook-divider border-b px-3 py-2">
                        <Skeleton className="h-4 w-24" />
                    </CardHeader>
                    <CardContent className="space-y-3 p-3">
                        {Array.from({ length: 7 }, (_, index) => (
                            <Skeleton
                                key={index}
                                className={index === 6 ? "h-36 w-full" : "h-4 w-full"}
                            />
                        ))}
                    </CardContent>
                </Card>
            </div>
        </>
    );
}

export function HeaderUserSkeleton() {
    return (
        <div className="flex shrink-0 items-center gap-2">
            <Skeleton className="hidden h-4 w-40 shrink-0 sm:block" />
            <Skeleton className="size-8 shrink-0 rounded-full" />
        </div>
    );
}

export function NameSkeleton() {
    return (
        <Skeleton className="h-8 w-40 border-2 sm:w-64" />
    );
}

export function WallPostSkeleton() {
    return (
        <Card className="gap-0 rounded-sm border border-[#d7dce2] py-0 shadow-none">
            <CardContent className="flex gap-3 p-3 sm:p-4">
                <Avatar className="size-10 shrink-0 rounded-sm">
                    <AvatarFallback>
                        <Skeleton className="size-full rounded-sm" />
                    </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 space-y-3">
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-8 w-16" />
                </div>
            </CardContent>
        </Card>
    );
}
