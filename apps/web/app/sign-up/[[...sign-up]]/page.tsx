import { LegalFooter } from "@/app/_components/legal";
import { SignInOrDesktop } from "@/app/sign-in/[[...sign-in]]/sign-in-or-desktop";

export default function SignUpPage() {
  return (
    <main className="flex h-dvh flex-col overflow-y-auto [-webkit-app-region:drag]">
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="[-webkit-app-region:no-drag]">
          <SignInOrDesktop mode="sign-up" />
        </div>
      </div>
      <LegalFooter className="pb-6" />
    </main>
  );
}
