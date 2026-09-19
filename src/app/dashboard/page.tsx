import Workspace from "@/components/workspace";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <Workspace
      storageScope={user.id}
      cloudEnabled
      nowIso={new Date().toISOString()}
      username={user.username}
    />
  );
}
