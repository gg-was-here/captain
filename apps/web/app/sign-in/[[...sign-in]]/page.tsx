import { LegalFooter } from "@/app/_components/legal";
import { SignInOrDesktop } from "./sign-in-or-desktop";

export default function SignInPage() {
  return (
    <main className="flex h-dvh flex-col overflow-y-auto [-webkit-app-region:drag]">
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="[-webkit-app-region:no-drag]">
          <SignInOrDesktop />
        </div>
      </div>
      <LegalFooter className="pb-6" />
    </main>
  );
}
