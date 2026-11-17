import type { Metadata } from "next";
import FriendsPage from "@/components/features/friends/FriendsPage";

export const metadata: Metadata = {
  title: "Friends",
  description: "Meet the friends in your Piecebook crew.",
};

export default function Page() {
  return <FriendsPage />;
}
