import "./demo.css";
import { DemoShell } from "./DemoShell";

export function DemoLayout() {
  return (
    <div className="demo-root min-h-screen bg-muted/30 text-foreground">
      <DemoShell />
    </div>
  );
}
