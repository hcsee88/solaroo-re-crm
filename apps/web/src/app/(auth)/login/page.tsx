import type { Metadata } from "next";
import { LoginForm } from "@/features/auth/components/login-form";

export const metadata: Metadata = { title: "Sign In" };

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40">
      <div className="w-full max-w-sm space-y-6 p-8 bg-card rounded-xl shadow-sm border">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Solaroo RE CRM</h1>
          <p className="text-sm text-muted-foreground">Sign in to your account</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
