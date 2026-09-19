"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import styles from "@/app/landing.module.css";

const STORAGE_KEY = "unfuckdsa-landing-theme";

export default function LandingThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(STORAGE_KEY);
    const shouldUseDark = savedTheme
      ? savedTheme === "dark"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;

    setDark(shouldUseDark);
    document.documentElement.dataset.landingTheme = shouldUseDark ? "dark" : "light";

    return () => {
      document.documentElement.removeAttribute("data-landing-theme");
    };
  }, []);

  function toggleTheme() {
    const nextDark = !dark;
    setDark(nextDark);
    document.documentElement.dataset.landingTheme = nextDark ? "dark" : "light";
    window.localStorage.setItem(STORAGE_KEY, nextDark ? "dark" : "light");
  }

  return (
    <button
      aria-label={dark ? "Use light mode" : "Use dark mode"}
      aria-pressed={dark}
      className={styles.themeToggle}
      onClick={toggleTheme}
      title={dark ? "Use light mode" : "Use dark mode"}
      type="button"
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
