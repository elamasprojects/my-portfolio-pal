import type { ReactNode } from "react";
import type { DeviceKind } from "../data/types";
import { PhoneBezel } from "./PhoneBezel";
import { WatchBezel } from "./WatchBezel";

export function DeviceFrame({
  device,
  app,
  watch,
}: {
  device: DeviceKind;
  app: ReactNode;
  watch: ReactNode;
}) {
  if (device === "watch") return <WatchBezel>{watch}</WatchBezel>;
  if (device === "phone") return <PhoneBezel>{app}</PhoneBezel>;
  return <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6">{app}</div>;
}
