"use client";

import { useClerk } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

export function SignOut() {
  const { signOut } = useClerk();
  return (
    <Button onClick={() => void signOut({ redirectUrl: "/sign-in" })} size="sm" variant="outline">
      Sign out
    </Button>
  );
}
