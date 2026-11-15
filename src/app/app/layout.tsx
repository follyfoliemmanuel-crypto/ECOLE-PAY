import { AppShell } from "@/components/app/app-shell";
import { exigerSession } from "@/lib/auth";

export default async function LayoutApplication({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await exigerSession();
  return <AppShell session={session}>{children}</AppShell>;
}
