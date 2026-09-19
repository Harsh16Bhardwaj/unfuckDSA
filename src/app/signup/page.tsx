import { redirect } from "next/navigation";
import LoginForm from "@/components/login-form";
import { getCurrentUser } from "@/lib/auth";

export default async function SignupPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  return <LoginForm mode="signup" />;
}
