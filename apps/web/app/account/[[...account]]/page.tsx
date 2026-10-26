import { UserProfile } from "@clerk/nextjs";

export const metadata = { title: "Account · Bambii" };

/** Profile, security and passkeys. The Mac app opens this in the default browser so passkey setup works. */
export default function AccountPage() {
  return (
    <main className="flex min-h-dvh justify-center p-6">
      <UserProfile path="/account" />
    </main>
  );
}
