import { useEffect, useState } from "react";
import {
  getResolvedTheme,
  setThemePreference,
  subscribeToThemeChange,
  type ResolvedTheme,
} from "../lib/theme.js";

export function useTheme(): { resolved: ResolvedTheme; toggle: () => void } {
  const [resolved, setResolved] = useState<ResolvedTheme>(getResolvedTheme);

  useEffect(() => subscribeToThemeChange(() => setResolved(getResolvedTheme())), []);

  const toggle = () => {
    setThemePreference(resolved === "dark" ? "light" : "dark");
  };

  return { resolved, toggle };
}
