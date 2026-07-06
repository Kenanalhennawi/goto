import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";
import { SiteHeader } from "@/components/SiteHeader";

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center px-6 py-10">
        <ForgotPasswordForm />
      </main>
    </div>
  );
}
