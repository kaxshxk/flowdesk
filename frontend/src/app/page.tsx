import { redirect } from "next/navigation";

// Root "/" immediately redirects to login.
// If the user is already authenticated, RouteGuard will push them to their dashboard.
export default function RootIndex() {
  redirect("/login");
}
