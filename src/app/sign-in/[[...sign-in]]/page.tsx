import { SignIn } from "@clerk/nextjs";

// Clerk's prebuilt sign-in UI. The [[...sign-in]] catch-all route lets Clerk
// handle its own sub-paths (e.g. verification steps).
export default function SignInPage() {
  return (
    <div className="flex justify-center py-8">
      <SignIn />
    </div>
  );
}
