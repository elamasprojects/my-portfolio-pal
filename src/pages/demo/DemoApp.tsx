import { RequireAuth } from "@/components/RequireAuth";
import { DemoLayout } from "./DemoLayout";

/**
 * Route entry for the /demo Design Lab. Auth-gated (shared RequireAuth), rendered in a
 * custom DemoLayout (not AppLayout) so the production sidebar / old mobile nav never appear.
 */
export default function DemoApp() {
  return (
    <RequireAuth>
      <DemoLayout />
    </RequireAuth>
  );
}
