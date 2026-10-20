import { SignInOrDesktop } from "@/app/sign-in/[[...sign-in]]/sign-in-or-desktop";

export default function SignUpPage() {
  return (
    <main className="flex h-dvh items-center justify-center [-webkit-app-region:drag]">
      <div className="[-webkit-app-region:no-drag]">
        <SignInOrDesktop mode="sign-up" />
      </div>
    </main>
  );
}
