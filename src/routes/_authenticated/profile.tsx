import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getMyProfile, updateMyProfile } from "@/lib/user-keys.functions";
import { fileToDataUrl, readBranding, saveBranding } from "@/lib/branding";
import { toast } from "sonner";
import { swalSuccess } from "@/lib/swal";
import { UserRound, Image as ImageIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import defaultLogoUrl from "@/assets/panme-logo.jpg";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "AutoUPI | Profile & Branding" },
      { name: "description", content: "Update your shop name, dashboard logo and browser favicon." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const get = useServerFn(getMyProfile);
  const save = useServerFn(updateMyProfile);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [brandName, setBrandName] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [favicon, setFavicon] = useState<string | null>(null);

  const logoInput = useRef<HTMLInputElement>(null);
  const faviconInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    get()
      .then((p: any) => {
        setBrandName(p.brand_name ?? "");
        setLogo(p.logo_url ?? null);
        setFavicon(p.favicon_url ?? null);
        saveBranding({ brand_name: p.brand_name ?? null, logo_url: p.logo_url ?? null, favicon_url: p.favicon_url ?? null });
      })
      .catch((e: any) => {
        toast.error(e.message);
        const cached = readBranding();
        setBrandName(cached.brand_name ?? "");
        setLogo(cached.logo_url ?? null);
        setFavicon(cached.favicon_url ?? null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function pick(kind: "logo" | "favicon", file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Please choose an image file");
    try {
      const dataUrl = await fileToDataUrl(file, kind === "logo" ? 256 : 64);
      if (kind === "logo") setLogo(dataUrl);
      else setFavicon(dataUrl);
    } catch (e: any) {
      toast.error(e.message ?? "Could not process image");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const saved = await save({ data: { brand_name: brandName.trim(), logo_url: logo, favicon_url: favicon } });
      setBrandName(saved.brand_name ?? "");
      setLogo(saved.logo_url ?? null);
      setFavicon(saved.favicon_url ?? null);
      saveBranding({ brand_name: saved.brand_name, logo_url: saved.logo_url, favicon_url: saved.favicon_url });
      swalSuccess("Profile updated successfully");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-[#0d4a3a] to-[#1b6e54] shadow-xl p-6 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
          <UserRound className="w-6 h-6 text-white" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-white truncate">Profile</h1>
          <p className="text-sm text-emerald-100/90 mt-0.5">Shop name, logo and favicon</p>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl shadow-xl border border-black/5 p-8 space-y-3">
          <Skeleton className="h-7 w-48 rounded-md" />
          <Skeleton className="h-40 w-full rounded-lg" />
        </div>
      ) : (
        <form onSubmit={submit} className="bg-white rounded-2xl shadow-xl border border-black/5 p-8 space-y-6">
          <div>
            <label className="block text-sm font-medium mb-1.5">Shop name (shown on the QR page)</label>
            <input
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="Panme Shop"
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-[#0d4a3a] outline-none"
            />
            <p className="text-xs text-gray-500 mt-1.5">
              This name replaces the shop name on the payment page. The QR logo stays fixed.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            <BrandUpload
              title="App logo"
              hint="Shown on the login page and in the sidebar."
              preview={logo || defaultLogoUrl}
              onPick={() => logoInput.current?.click()}
              onRemove={logo ? () => setLogo(null) : undefined}
            />
            <BrandUpload
              title="Favicon"
              hint="Shown in the browser tab."
              preview={favicon || "/favicon.png"}
              onPick={() => faviconInput.current?.click()}
              onRemove={favicon ? () => setFavicon(null) : undefined}
            />
          </div>

          <input
            ref={logoInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => pick("logo", e.target.files?.[0])}
          />
          <input
            ref={faviconInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => pick("favicon", e.target.files?.[0])}
          />

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3.5 rounded-lg bg-[#0d4a3a] hover:bg-[#0a3d30] text-white font-bold tracking-wide transition disabled:opacity-60"
          >
            {saving ? "Saving…" : "SAVE PROFILE"}
          </button>
        </form>
      )}
    </div>
  );
}

function BrandUpload({
  title,
  hint,
  preview,
  onPick,
  onRemove,
}: {
  title: string;
  hint: string;
  preview: string;
  onPick: () => void;
  onRemove?: () => void;
}) {
  return (
    <div className="rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-3">
        <ImageIcon className="w-4 h-4 text-[#0d4a3a]" />
        <h3 className="font-semibold text-[#0d1b2a]">{title}</h3>
      </div>
      <div className="flex items-center gap-4">
        <img src={preview} alt={title} className="w-16 h-16 rounded-lg object-contain border border-gray-200 bg-gray-50 p-1" />
        <div className="flex flex-col gap-2">
          <button type="button" onClick={onPick} className="px-4 py-2 rounded-lg border border-[#0d4a3a] text-[#0d4a3a] text-sm font-semibold">
            Upload
          </button>
          {onRemove ? (
            <button type="button" onClick={onRemove} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm">
              Reset
            </button>
          ) : null}
        </div>
      </div>
      <p className="text-xs text-gray-500 mt-3">{hint}</p>
    </div>
  );
}
