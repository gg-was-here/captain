import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main className="flex h-dvh items-center justify-center [-webkit-app-region:drag]">
      <div className="[-webkit-app-region:no-drag]">
        <SignIn />
      </div>
    </main>
  );
}
