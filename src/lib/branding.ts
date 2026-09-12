// Lightweight client-side branding cache.
// Logo / favicon are stored as small data-URLs on the user's profile and
// cached in localStorage so the (public) login page can show them too.
import { useEffect, useState } from "react";

export const BRANDING_KEY = "autoupi.branding";

export type Branding = {
  logo_url?: string | null;
  favicon_url?: string | null;
  brand_name?: string | null;
};

export function readBranding(): Branding {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(BRANDING_KEY) ?? "{}") as Branding;
  } catch {
    return {};
  }
}

export function saveBranding(b: Branding) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(BRANDING_KEY, JSON.stringify(b));
  } catch {
    /* quota — ignore */
  }
  applyFavicon(b.favicon_url ?? null);
  window.dispatchEvent(new CustomEvent("autoupi-branding"));
}

export function applyFavicon(href: string | null) {
  if (typeof document === "undefined") return;
  const url = href || "/favicon.png";
  document.querySelectorAll<HTMLLinkElement>("link[rel~='icon']").forEach((l) => l.remove());
  const link = document.createElement("link");
  link.rel = "icon";
  link.href = url;
  document.head.appendChild(link);
}

/** Returns cached branding and keeps it in sync across the app. */
export function useBranding(): Branding {
  const [b, setB] = useState<Branding>({});
  useEffect(() => {
    const sync = () => {
      const next = readBranding();
      setB(next);
      applyFavicon(next.favicon_url ?? null);
    };
    sync();
    window.addEventListener("autoupi-branding", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("autoupi-branding", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return b;
}

/** Resize an uploaded image to a compact square PNG before saving it. */
export function fileToDataUrl(file: File, size: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Invalid image"));
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas not supported"));
        const scale = Math.min(size / img.width, size / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        const dataUrl = canvas.toDataURL("image/png");
        if (dataUrl.length > 180_000) {
          reject(new Error("Image is too detailed. Please choose a simpler or smaller image."));
          return;
        }
        resolve(dataUrl);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
