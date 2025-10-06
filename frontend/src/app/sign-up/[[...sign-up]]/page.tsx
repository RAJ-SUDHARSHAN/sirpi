import { SignUp } from "@clerk/nextjs";
import { dark } from "@clerk/themes";

export default function Page() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
      <div className="relative flex items-center justify-center min-h-screen pt-20">
        <SignUp
        //   forceRedirectUrl="/projects"
          appearance={{
            baseTheme: dark,
          }}
        />
      </div>
    </div>
  );
}
