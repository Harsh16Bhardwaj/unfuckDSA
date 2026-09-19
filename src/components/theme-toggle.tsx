"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";

const STORAGE_KEY = "unfuckdsa-theme";
const LEGACY_STORAGE_KEY = "unfuckdsa-landing-theme";
const THEME_EVENT = "unfuckdsa-theme-change";

function getThemeSnapshot() {
  const savedTheme = window.localStorage.getItem(STORAGE_KEY)
    ?? window.localStorage.getItem(LEGACY_STORAGE_KEY);
  return savedTheme
    ? savedTheme === "dark"
    : window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function subscribeToTheme(callback: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  window.addEventListener(THEME_EVENT, callback);
  window.addEventListener("storage", callback);
  media.addEventListener("change", callback);

  return () => {
    window.removeEventListener(THEME_EVENT, callback);
    window.removeEventListener("storage", callback);
    media.removeEventListener("change", callback);
  };
}

export default function ThemeToggle({ className = "" }: { className?: string }) {
  const dark = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, () => false);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  }, [dark]);

  function toggleTheme() {
    const nextDark = !dark;
    document.documentElement.dataset.theme = nextDark ? "dark" : "light";
    window.localStorage.setItem(STORAGE_KEY, nextDark ? "dark" : "light");
    window.dispatchEvent(new Event(THEME_EVENT));
  }

  return (
    <button
      aria-label={dark ? "Use light mode" : "Use dark mode"}
      aria-pressed={dark}
      className={`theme-toggle ${className}`.trim()}
      onClick={toggleTheme}
      title={dark ? "Use light mode" : "Use dark mode"}
      type="button"
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
