import { createFileRoute, useNavigate, redirect, isRedirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { swalSuccess } from "@/lib/swal";
import defaultLogoUrl from "@/assets/panme-logo.jpg";
import { useBranding } from "@/lib/branding";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "AutoUPI | Sign In" },
      { name: "description", content: "Sign in or create your AutoUPI payment gateway account." },
    ],
  }),
  beforeLoad: async () => {
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session) throw redirect({ to: "/generate" });
    } catch (err) {
      if (isRedirect(err)) throw err;
      // Supabase not configured yet — render the sign-in page instead of crashing.
    }
  },
  component: AuthPage,
});

type Mode = "login" | "register";

function AuthPage() {
  const [mode, setMode] = useState<Mode>("login");
  const branding = useBranding();
  const logoUrl = branding.logo_url || defaultLogoUrl;


  return (
    <main className="min-h-screen flex bg-white">
      {/* Left green panel */}
      <section className="hidden md:flex md:w-1/2 bg-gradient-to-br from-[#0d4a3a] to-[#0a3d30] text-white p-12 flex-col">
        <div className="flex items-center gap-3">
          <img src={logoUrl} alt="AutoUPI" className="w-12 h-12 object-contain rounded-xl bg-white/10 p-1.5" />
          <h1 className="text-2xl font-bold tracking-tight">AutoUPI</h1>
        </div>

         <div className="mt-12 max-w-lg">
           <h2 className="font-serif italic text-4xl lg:text-5xl leading-tight">
             {mode === "login"
                ? "Accept UPI payments — instantly verified."
                : "Set up your gateway. Start collecting in minutes."}
           </h2>
           <p className="mt-4 text-white/80 text-base">AutoUPI Payment Gateway.</p>
         </div>

         <div className="mt-auto pt-12 grid grid-cols-2 gap-3 max-w-lg">
           {[
              { t: "Instant QR", s: "Generate in seconds." },
              { t: "Auto-verify", s: "Confirmed via email." },
              { t: "Real-time", s: "Webhook callbacks." },
              { t: "Secure", s: "Bank-grade safety." },
           ].map((f) => (
              <div key={f.t} className="bg-white/5 border border-white/10 rounded-xl p-4 backdrop-blur-sm">




                 <div className="font-bold">{f.t}</div>
                 <div className="text-xs text-white/70 mt-0.5">{f.s}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Right panel */}
        <section className="flex-1 flex items-center justify-center p-6 sm:p-10 bg-white">
          <div className="w-full max-w-md">
            <div className="flex md:hidden items-center gap-3 mb-8">
              <img src={logoUrl} alt="AutoUPI" className="w-10 h-10 object-contain" />
              <span className="text-xl font-bold text-[#0d4a3a]">AutoUPI</span>
            </div>

            {mode === "login" ? (
               <LoginForm onSwitch={() => setMode("register")} />
            ) : (
               <RegisterForm onSwitch={() => setMode("login")} />
            )}
          </div>
        </section>
      </main>
    );
}

function LoginForm({ onSwitch }: { onSwitch: () => void }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

    async function submit(e: React.FormEvent) {
      e.preventDefault();
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) return toast.error(error.message);
      await swalSuccess("Logged in successfully");
      navigate({ to: "/generate" });
    }

    async function onForgot() {
      if (!email) return toast.error("Enter your email above first");
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) return toast.error(error.message);
      swalSuccess("Password reset link sent to your email");
    }

    return (
      <form onSubmit={submit}>
        <h2 className="text-3xl font-extrabold text-[#0d1b2a] mb-8">Sign in to Account</h2>

        <Field label="Email">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            className={inputCls}
          />
        </Field>

      <div className="mt-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-[#0d1b2a]">Password</span>
          <button type="button" onClick={onForgot} className="text-sm font-semibold text-[#0d4a3a] hover:underline cursor-pointer">
             Forgot Password?
          </button>
        </div>
        <div className="relative">
          <input
             type={showPass ? "text" : "password"}
             required
             value={password}
             onChange={(e) => setPassword(e.target.value)}
             placeholder="Enter your password"
             className={`${inputCls} pr-11`}
          />
          <button type="button" onClick={() => setShowPass((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 cursor-pointer">

               {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}




        className="mt-7 w-full py-3.5 rounded-lg bg-[#0d4a3a] hover:bg-[#0a3d30] text-white font-bold tracking-wide transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Signing in…" : "LOGIN"}
      </button>

      </form>
    );
}

function RegisterForm({ onSwitch }: { onSwitch: () => void }) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [agree, setAgree] = useState(true);
  const [loading, setLoading] = useState(false);

    async function submit(e: React.FormEvent) {
      e.preventDefault();
      if (!agree) return toast.error("Please accept the Terms and Privacy Policy");
      if (!/^\d{10}$/.test(whatsapp)) return toast.error("Enter a valid 10-digit WhatsApp number");
      setLoading(true);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/generate`,
          data: { display_name: name.trim(), whatsapp: `+91${whatsapp}` },
        },
      });
      setLoading(false);
      if (error) return toast.error(error.message);
      if (data.session) {
        await swalSuccess("Account created successfully");
        navigate({ to: "/generate" });
      } else {
        await swalSuccess("Account created — check your email to confirm.");
        onSwitch();
      }
    }

    return (
      <form onSubmit={submit}>
        <h2 className="text-3xl font-extrabold text-[#0d1b2a] mb-6">Register new account</h2>

       <Field label="Name">
         <input
           required
           value={name}
           onChange={(e) => setName(e.target.value)}
           placeholder="Enter Your Name"
           className={inputCls}
           maxLength={80}
         />
       </Field>

      <div className="mt-5">
        <label className="block text-sm font-medium text-[#0d1b2a] mb-2">WhatsApp No.</label>
        <div className="flex items-stretch rounded-lg border border-[#0d4a3a]/30 focus-within:border-[#0d4a3a] focus-within:ring-2 focus-within:ring-[#0d4a3a]/20 overflow-hidden">
          <span className="px-3 flex items-center bg-gray-50 border-r border-[#0d4a3a]/20 text-[#0d1b2a] font-medium">+91</span>
          <input
             required
             value={whatsapp}
             onChange={(e) => setWhatsapp(e.target.value.replace(/\D/g, "").slice(0, 10))}
             placeholder="10-digit whatsapp number"
             inputMode="numeric"
             className="flex-1 px-3 py-3 outline-none"
          />
        </div>
      </div>

       <div className="mt-5">
         <Field label="Email">
           <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter Email"
              className={inputCls}
           />
         </Field>
       </div>

       <div className="mt-5">
         <label className="block text-sm font-medium text-[#0d1b2a] mb-2">Password</label>
         <div className="relative">
           <input
             type={showPass ? "text" : "password"}
             required




              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create a password"
              className={`${inputCls} pr-11`}
            />
            <button type="button" onClick={() => setShowPass((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 cursor-pointer">
              {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
           </button>
         </div>
       </div>

       <label className="flex items-start gap-2 mt-5 text-sm text-[#0d1b2a]">
         <input
           type="checkbox"
           checked={agree}
           onChange={(e) => setAgree(e.target.checked)}
           className="mt-0.5 w-4 h-4 accent-[#0d4a3a]"
         />
         <span>
           I agree to the following: <a className="font-semibold underline">T&amp;C</a> and{" "}
           <a className="font-semibold underline">Privacy Policy</a>
         </span>
       </label>

      <button
        type="submit"
        disabled={loading || !agree}
        className="mt-6 w-full py-3.5 rounded-lg bg-[#0d4a3a] hover:bg-[#0a3d30] text-white font-bold tracking-wide transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Creating account…" : "REGISTER"}
      </button>

        <p className="text-center text-sm text-gray-600 mt-6">
          Have an account?{" "}
          <button type="button" onClick={onSwitch} className="font-bold text-[#0d4a3a] underline cursor-pointer">
            Login
          </button>
        </p>
      </form>
    );
}

const inputCls =
  "w-full px-4 py-3 rounded-lg border border-[#0d4a3a]/30 focus:border-[#0d4a3a] focus:ring-2 focus:ring-[#0d4a3a]/20 outline-none transition";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-[#0d1b2a]">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}
