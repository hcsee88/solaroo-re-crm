import { redirect } from "next/navigation";

// Root redirects to the dashboard (auth middleware handles unauthenticated users)
export default function RootPage() {
  redirect("/dashboard");
}
