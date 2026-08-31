import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { swalSuccess } from "@/lib/swal";

export const Route = createFileRoute("/signup")({
  ssr: false,
  head: () => ({ meta: [{ title: "AutoUPI | Create Account" }] }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

    async function signup(e: React.FormEvent) {
      e.preventDefault();
      if (password.length < 6) return toast.error("Password must be at least 6 characters");
      setLoading(true);
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/generate`,
          data: { display_name: name },
        },




        });
        setLoading(false);
        if (error) return toast.error(error.message);
        await swalSuccess("Account created successfully");
        const { error: e2 } = await supabase.auth.signInWithPassword({ email, password });
        if (e2) return toast.error(e2.message);
        navigate({ to: "/generate" });
    }

    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0d4a3a] to-[#0a3d30] p-6">
        <form onSubmit={signup} className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-2xl font-extrabold text-[#0d1b2a] mb-1">Create your account</h2>
          <p className="text-sm text-gray-500 mb-6">Start generating UPI payment links.</p>

        <label className="block mb-4">
          <span className="text-sm font-medium">Display name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required className="mt-1 w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-[#0d4a3a] outline-none" />
        </label>
        <label className="block mb-4">
          <span className="text-sm font-medium">Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1 w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-[#0d4a3a] outline-none" />
        </label>
        <label className="block mb-6">
          <span className="text-sm font-medium">Password</span>
          <div className="relative mt-1">
            <input type={showPass ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full px-4 py-3 pr-11 rounded-lg border border-gray-300 focus:border-[#0d4a3a] outline-none" />
            <button type="button" onClick={() => setShowPass(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
              {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </label>

        <button type="submit" disabled={loading} className="w-full py-3 rounded-lg bg-[#0d4a3a] hover:bg-[#0a3d30] text-white font-bold tracking-wide transition disabled:opacity-60">
          {loading ? "Creating…" : "CREATE ACCOUNT"}
        </button>

          <p className="text-center text-sm text-gray-600 mt-5">
            Already have an account?{" "}
            <Link to="/auth" className="text-[#0d4a3a] font-semibold hover:underline">Sign in</Link>
          </p>
        </form>
      </main>
    );
}
