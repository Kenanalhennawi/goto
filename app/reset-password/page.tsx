import { ResetPasswordForm } from "@/components/ResetPasswordForm";
import { SiteHeader } from "@/components/SiteHeader";

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center px-6 py-10">
        <ResetPasswordForm />
      </main>
    </div>
  );
}
