export type Category =
  | "Vehicles"
  | "Property Rentals"
  | "Apparel"
  | "Classifieds"
  | "Electronics"
  | "Entertainment"
  | "Family"
  | "Free Stuff"
  | "Garden & Outdoor"
  | "Hobbies"
  | "Home Goods"
  | "Home Improvement Supplies"
  | "Home Sales"
  | "Musical Instruments"
  | "Office Supplies"
  | "Pet Supplies"
  | "Sporting Goods"
  | "Toys & Games";

export type Listing = {
  id: string;
  title: string;
  price: number;
  previousPrice?: number;
  location: string;
  category: Category;
  image: string;
  condition: string;
  color?: string;
  material?: string;
  seller: string;
  description: string;
  listed: string;
  isSponsored?: boolean;
  photos?: string[];
  categoryDetails?: Record<string, string>;
};

export const image = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=82`;

export const initialListings: Listing[] = [
  {
    id: "oak-bed",
    title: "Solid oak platform bed frame",
    price: 2300,
    location: "Menlo Park, CA",
    category: "Home Goods",
    image: image("photo-1505693416388-ac5ce068fe85"),
    condition: "Used - like new",
    seller: "Maya Chen",
    description: "Beautiful solid oak bed frame in excellent condition. Mattress not included. Pickup in Menlo Park.",
    listed: "2 days ago",
  },
  {
    id: "digital-piano",
    title: "88-key digital piano — only $50!",
    price: 50,
    location: "Menlo Park, CA",
    category: "Musical Instruments",
    image: image("photo-1520523839897-bd0b52f945a0"),
    condition: "Used - good",
    seller: "Jordan Lee",
    description: "A lovely full-size digital piano, includes sustain pedal and stand. Great for a first instrument.",
    listed: "1 day ago",
  },
  {
    id: "floating-shelf",
    title: "Set of 3 tier floating shelves",
    price: 10,
    location: "Palo Alto, CA",
    category: "Home Goods",
    image: image("photo-1594620302200-9a762244a156"),
    condition: "Used - like new",
    seller: "Sam Rivera",
    description: "Three wooden shelves with black metal brackets. All mounting hardware included.",
    listed: "5 hours ago",
  },
  {
    id: "victorian-home",
    title: "Palo Alto downtown office for rent",
    price: 1750,
    location: "Palo Alto, CA",
    category: "Property Rentals",
    image: image("photo-1600585154340-be6161a56a0c"),
    condition: "Available now",
    seller: "Evergreen Realty",
    description: "Bright, charming downtown space with easy access to shops, cafes, and Caltrain.",
    listed: "3 days ago",
  },
  {
    id: "vintage-print",
    title: "Rare vintage Thomas McKnight print",
    price: 559,
    location: "Palo Alto, CA",
    category: "Hobbies",
    image: image("photo-1577083552431-6e5fd01aa342"),
    condition: "Used - good",
    seller: "Art House Finds",
    description: "Colorful framed print in a classic gold frame. A beautiful accent for any room.",
    listed: "6 hours ago",
  },
  {
    id: "upright-piano",
    title: "Eastlake upright piano",
    price: 150,
    location: "Palo Alto, CA",
    category: "Musical Instruments",
    image: image("photo-1552422535-c45813c61732"),
    condition: "Used - fair",
    seller: "Nico Williams",
    description: "Classic upright piano with a rich sound. Buyer will need to arrange pickup and moving.",
    listed: "4 days ago",
  },
  {
    id: "mac-mini",
    title: "Brand new sealed Mac mini",
    price: 325,
    location: "Palo Alto, CA",
    category: "Electronics",
    image: image("photo-1517336714731-489689fd1ca8"),
    condition: "New",
    seller: "Kai Morgan",
    description: "Brand new, still sealed. Bought as a gift and never opened. Cash or Venmo at pickup.",
    listed: "1 day ago",
  },
  {
    id: "ktm-motorcycle",
    title: "2021 KTM 390 adventure",
    price: 22500,
    location: "Unincorporated, CA",
    category: "Vehicles",
    image: image("photo-1558981806-ec527fa84c39"),
    condition: "Used - good",
    seller: "Chris Nolan",
    description: "Adventure-ready and well maintained. Clean title, 28k miles, lots of recent service.",
    listed: "1 week ago",
  },
  {
    id: "monaco-rv",
    title: "2003 Monaco Cayman motorhome",
    price: 39000,
    location: "Los Angeles, CA",
    category: "Vehicles",
    image: image("photo-1543799382-9a0208331c0e"),
    condition: "Used - good",
    seller: "Road Trip Ready",
    description: "Spacious motorhome with a comfortable interior, ready for its next adventure.",
    listed: "2 days ago",
  },
  {
    id: "tesla-model-3",
    title: "2025 Tesla Model 3",
    price: 32000,
    location: "Menlo Park, CA",
    category: "Vehicles",
    image: image("photo-1492144534655-ae79c964c9d7"),
    condition: "Used - like new",
    seller: "Alex Parker",
    description: "Clean, modern electric sedan with a glass roof and low mileage. Available for a test drive.",
    listed: "4 hours ago",
  },
  {
    id: "living-room",
    title: "Bright living room, available now",
    price: 3300,
    location: "Palo Alto, CA",
    category: "Property Rentals",
    image: image("photo-1600210492486-724fe5c67fb0"),
    condition: "Available now",
    seller: "Peninsula Homes",
    description: "Airy space with warm wood floors and plenty of natural light. Message for a tour.",
    listed: "Yesterday",
  },
  {
    id: "blue-bicycle",
    title: "Blue hybrid bicycle, ready to ride",
    price: 150,
    previousPrice: 300,
    location: "Palo Alto, CA",
    category: "Sporting Goods",
    image: image("photo-1485965120184-e220f721d03e"),
    condition: "Used - good",
    seller: "Taylor Brooks",
    description: "Comfortable hybrid bike with a fresh tune-up. Smooth shifting and great tires.",
    listed: "8 hours ago",
  },
  {
    id: "hp-monitor",
    title: "HP monitor, 27 inch",
    price: 45,
    location: "Menlo Park, CA",
    category: "Electronics",
    image: image("photo-1527864550417-7fd91fc51a46"),
    condition: "Used - good",
    seller: "Morgan James",
    description: "Clear 27-inch display with an adjustable stand. Works perfectly and includes power cable.",
    listed: "2 days ago",
  },
  {
    id: "living-room-tv",
    title: "Samsung 55 inch flat screen TV",
    price: 200,
    previousPrice: 300,
    location: "Stanford, CA",
    category: "Electronics",
    image: image("photo-1593359677879-a4bb92f829d1"),
    condition: "Used - good",
    seller: "Devin Scott",
    description: "Great picture and sound, no issues. Comes with remote and stand.",
    listed: "3 hours ago",
  },
  {
    id: "mountain-bike",
    title: "Mountain bike — barely used",
    price: 100,
    location: "Palo Alto, CA",
    category: "Sporting Goods",
    image: image("photo-1576435728678-68d0fbf94e91"),
    condition: "Used - like new",
    seller: "You",
    description: "Selling my mountain bike after an upgrade. Rides great, includes a bottle cage and lights.",
    listed: "Just listed",
  },
  {
    id: "free-planters",
    title: "Free ceramic planters — pickup today",
    price: 0,
    location: "Menlo Park, CA",
    category: "Free Stuff",
    image: image("photo-1485955900006-10f4d324d411"),
    condition: "Used - good",
    seller: "Robin Ellis",
    description: "A few planters looking for a new home. Free for porch pickup.",
    listed: "45 minutes ago",
  },
  {
    id: "desk-lamp",
    title: "Minimal brass desk lamp",
    price: 28,
    location: "Palo Alto, CA",
    category: "Home Goods",
    image: image("photo-1507473885765-e6ed057f782c"),
    condition: "Used - like new",
    seller: "Emery Lane",
    description: "Warm brass finish and adjustable arm. Includes a fresh LED bulb.",
    listed: "1 day ago",
  },
  {
    id: "camera-kit",
    title: "Canon mirrorless camera starter kit",
    price: 480,
    location: "Palo Alto, CA",
    category: "Electronics",
    image: image("photo-1516035069371-29a1b244cc32"),
    condition: "Used - like new",
    seller: "Jamie Kim",
    description: "Camera body, kit lens, two batteries, and a padded carrying bag. Everything works beautifully.",
    listed: "6 hours ago",
  },
];


export const categoryDetailFields: Record<Category, string[]> = {
  Vehicles: ['Make', 'Model', 'Year', 'Mileage', 'Color'],
  'Property Rentals': ['Bedrooms', 'Bathrooms', 'Square feet', 'Lease term'],
  Apparel: ['Brand', 'Size', 'Color', 'Material'],
  Classifieds: ['Brand', 'Color', 'Material'],
  Electronics: ['Brand', 'Model', 'Storage', 'Color'],
  Entertainment: ['Type', 'Brand', 'Color'],
  Family: ['Age range', 'Brand', 'Color'],
  'Free Stuff': ['Color', 'Material'],
  'Garden & Outdoor': ['Brand', 'Material', 'Dimensions'],
  Hobbies: ['Brand', 'Model', 'Material'],
  'Home Goods': ['Brand', 'Material', 'Dimensions', 'Color'],
  'Home Improvement Supplies': ['Brand', 'Material', 'Quantity'],
  'Home Sales': ['Bedrooms', 'Bathrooms', 'Square feet', 'Year built'],
  'Musical Instruments': ['Brand', 'Instrument type', 'Color', 'Material'],
  'Office Supplies': ['Brand', 'Model', 'Quantity'],
  'Pet Supplies': ['Pet type', 'Brand', 'Size'],
  'Sporting Goods': ['Brand', 'Sport type', 'Size', 'Color'],
  'Toys & Games': ['Brand', 'Age range', 'Material'],
};

export const marketplaceCategories = Object.keys(categoryDetailFields) as Category[];

export const formatPrice = (price: number) =>
  price === 0 ? "Free" : `$${price.toLocaleString("en-US")}`;

export const isOwnMarketplaceListing = (listing: Pick<Listing, "seller">) =>
  listing.seller === "You";

const USER_LISTINGS_KEY = "piecebook_marketplace_listings";
const emptyUserListings: Listing[] = [];
let inMemoryUserListings: Listing[] = [];
let userListingsSnapshot: Listing[] | null = null;
const listingSnapshots = new Map<string, MarketplaceListingSnapshot>();
const listingListeners = new Set<() => void>();
const serverLoadingSnapshot: MarketplaceListingSnapshot = { status: "loading", listing: null };

export type MarketplaceListingSnapshot = {
  status: "loading" | "ready" | "not-found";
  listing: Listing | null;
};

export function readUserListings(): Listing[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = window.localStorage.getItem(USER_LISTINGS_KEY);
    const listings: unknown = stored ? JSON.parse(stored) : [];
    const persistedListings = Array.isArray(listings)
      ? listings.filter((listing): listing is Listing =>
          Boolean(
            listing &&
              typeof listing === "object" &&
              "id" in listing &&
              typeof listing.id === "string" &&
              "title" in listing &&
              typeof listing.title === "string" &&
              "image" in listing &&
              typeof listing.image === "string",
          ),
        )
      : [];
    return [...inMemoryUserListings, ...persistedListings].filter(
      (listing, index, all) => all.findIndex((candidate) => candidate.id === listing.id) === index,
    );
  } catch {
    return inMemoryUserListings;
  }
}

function notifyListingListeners() {
  listingListeners.forEach((listener) => listener());
}

function handleMarketplaceStorageChange() {
  userListingsSnapshot = null;
  listingSnapshots.clear();
  notifyListingListeners();
}

export function subscribeToMarketplaceListings(listener: () => void) {
  const hadListeners = listingListeners.size > 0;
  listingListeners.add(listener);
  if (!hadListeners && typeof window !== "undefined") window.addEventListener("storage", handleMarketplaceStorageChange);
  return () => {
    listingListeners.delete(listener);
    if (listingListeners.size === 0 && typeof window !== "undefined") window.removeEventListener("storage", handleMarketplaceStorageChange);
  };
}

export function getUserListingsSnapshot() {
  if (typeof window === "undefined") return emptyUserListings;
  if (!userListingsSnapshot) userListingsSnapshot = readUserListings();
  return userListingsSnapshot;
}

export function getServerUserListingsSnapshot() {
  return emptyUserListings;
}

export function getServerMarketplaceListingSnapshot() {
  return serverLoadingSnapshot;
}

export function getMarketplaceListingSnapshot(listingId: string): MarketplaceListingSnapshot {
  if (typeof window === "undefined") return serverLoadingSnapshot;
  const cached = listingSnapshots.get(listingId);
  if (cached) return cached;

  const listing = [...initialListings, ...getUserListingsSnapshot()].find((item) => item.id === listingId) ?? null;
  const snapshot: MarketplaceListingSnapshot = listing
    ? { status: "ready", listing }
    : { status: "not-found", listing: null };
  listingSnapshots.set(listingId, snapshot);
  return snapshot;
}

export function saveUserListing(listing: Listing) {
  if (typeof window === "undefined") return;

  inMemoryUserListings = [listing, ...inMemoryUserListings.filter((item) => item.id !== listing.id)];
  try {
    const listings = readUserListings().filter((item) => item.id !== listing.id);
    window.localStorage.setItem(USER_LISTINGS_KEY, JSON.stringify([listing, ...listings]));
  } catch {
    // Keep the listing available in the current view if browser storage is unavailable.
  }
  userListingsSnapshot = readUserListings();
  listingSnapshots.clear();
  notifyListingListeners();
}
