"use client";

import { ArrowDownWideNarrow, Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Category } from "./marketplace-data";

type MarketplaceSearchFiltersProps = {
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  category: Category | null;
  onCategoryChange: (value: Category | null) => void;
  condition: string;
  onConditionChange: (value: string) => void;
  minPrice: string;
  onMinPriceChange: (value: string) => void;
  maxPrice: string;
  onMaxPriceChange: (value: string) => void;
  sortOrder: string;
  onSortOrderChange: (value: string) => void;
  categories: Category[];
  conditions: string[];
};

export function MarketplaceSearchFilters({
  searchTerm,
  onSearchTermChange,
  category,
  onCategoryChange,
  condition,
  onConditionChange,
  minPrice,
  onMinPriceChange,
  maxPrice,
  onMaxPriceChange,
  sortOrder,
  onSortOrderChange,
  categories,
  conditions,
}: MarketplaceSearchFiltersProps) {
  const activeFilterCount =
    Number(Boolean(category)) +
    Number(Boolean(condition)) +
    Number(Boolean(minPrice)) +
    Number(Boolean(maxPrice));
  const clearFilters = () => {
    onCategoryChange(null);
    onConditionChange("");
    onMinPriceChange("");
    onMaxPriceChange("");
  };

  return (
    <div className="flex w-full min-w-0 items-center gap-2">
      <div className="relative min-w-0 flex-1">
        <label htmlFor="marketplace-search" className="sr-only">Search Marketplace</label>
        <Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="marketplace-search"
          placeholder="Search Marketplace"
          value={searchTerm}
          onChange={(event) => onSearchTermChange(event.target.value)}
          className="h-11 rounded-xl border-border/70 bg-card/80 pl-10 text-sm shadow-sm transition-shadow focus-visible:shadow-md"
        />
      </div>
      <Popover>
        <PopoverTrigger render={<Button type="button" variant="outline" aria-label="Open listing filters" className="h-11 gap-2 rounded-xl bg-card/80 px-3 text-sm font-semibold shadow-sm"><SlidersHorizontal className="size-4" /><span>Filters</span>{activeFilterCount > 0 && <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[11px] text-primary-foreground">{activeFilterCount}</span>}</Button>} />
        <PopoverContent align="end" className="w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl border bg-card p-4 shadow-xl">
          <PopoverHeader className="mb-2">
            <div className="flex items-center justify-between">
              <PopoverTitle className="text-base font-semibold">Filters</PopoverTitle>
              {activeFilterCount > 0 && <Button type="button" variant="ghost" onClick={clearFilters} className="h-8 gap-1 rounded-full px-3 text-xs"><X className="size-3" />Clear</Button>}
            </div>
          </PopoverHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground" htmlFor="marketplace-sort-order">Sort by</label>
              <Select value={sortOrder} onValueChange={(value) => onSortOrderChange(String(value ?? "newest"))}>
                <SelectTrigger id="marketplace-sort-order" className="h-11 w-full rounded-xl bg-background text-sm">
                  <ArrowDownWideNarrow className="size-4 text-muted-foreground" />
                  <SelectValue placeholder="Choose a sort order" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Date listed: newest</SelectItem>
                  <SelectItem value="price-low">Price: low to high</SelectItem>
                  <SelectItem value="price-high">Price: high to low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground" htmlFor="marketplace-filter-category">Category</label>
              <Select value={category ?? "all"} onValueChange={(value) => onCategoryChange(value === "all" ? null : String(value) as Category)}>
                <SelectTrigger id="marketplace-filter-category" className="h-11 w-full rounded-xl bg-background text-sm"><SelectValue placeholder="All categories" /></SelectTrigger>
                <SelectContent className="max-h-48">
                  <SelectItem value="all">All categories</SelectItem>
                  {categories.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground" htmlFor="marketplace-filter-condition">Condition</label>
              <Select value={condition || "all"} onValueChange={(value) => onConditionChange(value === "all" ? "" : String(value))}>
                <SelectTrigger id="marketplace-filter-condition" className="h-11 w-full rounded-xl bg-background text-sm"><SelectValue placeholder="Any condition" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any condition</SelectItem>
                  {conditions.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <fieldset className="space-y-1.5">
              <legend className="text-xs font-semibold text-muted-foreground">Price range</legend>
              <div className="flex items-center gap-2">
                <Input aria-label="Minimum price" type="number" min="0" value={minPrice} onChange={(event) => onMinPriceChange(event.target.value)} placeholder="Min" className="h-11 rounded-xl text-sm" />
                <span className="text-xs text-muted-foreground">to</span>
                <Input aria-label="Maximum price" type="number" min="0" value={maxPrice} onChange={(event) => onMaxPriceChange(event.target.value)} placeholder="Max" className="h-11 rounded-xl text-sm" />
              </div>
            </fieldset>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
