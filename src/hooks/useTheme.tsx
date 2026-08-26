import { useEffect } from "react";

export function useTheme() {
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.classList.add("dark");
    }
  }, []);

  return {
    theme: "dark" as const,
    toggleTheme: () => {},
  };
}
