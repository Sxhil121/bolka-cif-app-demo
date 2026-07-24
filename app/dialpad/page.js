import { Suspense } from "react";
import DialpadClient from "./DialpadClient";

// useSearchParams (needed to read the `ucilib` param Dynamics passes in)
// only works in a client component, and Next.js requires that component be
// wrapped in Suspense so the route doesn't de-opt entirely to client-side
// rendering.
export default function DialpadPage() {
  return (
    <Suspense fallback={null}>
      <DialpadClient />
    </Suspense>
  );
}
