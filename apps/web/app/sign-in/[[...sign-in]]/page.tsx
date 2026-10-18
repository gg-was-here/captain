import { SignInOrDesktop } from "./sign-in-or-desktop";

export default function SignInPage() {
  return (
    <main className="flex h-dvh items-center justify-center [-webkit-app-region:drag]">
      <div className="[-webkit-app-region:no-drag]">
        <SignInOrDesktop />
      </div>
    </main>
  );
}
