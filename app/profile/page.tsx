import type { Metadata } from "next";
import ProfilePageView from "@/components/features/profile/ProfilePage";

export const metadata: Metadata = {
  title: "Profile",
  description: "View your Piecebook profile and interests.",
};

export default function ProfilePage() {
  return <ProfilePageView />;
}
