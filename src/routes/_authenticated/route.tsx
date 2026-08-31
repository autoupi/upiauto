import { createFileRoute, Outlet, redirect, useNavigate, Link, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarMenu,
  SidebarMenuItem, SidebarMenuButton, SidebarProvider, SidebarTrigger, SidebarHeader, SidebarFooter,
} from "@/components/ui/sidebar";
import { QrCode, KeyRound, Settings, FileText, LogOut, History } from "lucide-react";
import { toast } from "sonner";
import { swalSuccess } from "@/lib/swal";
import logoUrl from "@/assets/finonpay-logo.jpg";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) throw redirect({ to: "/auth" });
      return { user: data.user };




    } catch (e) {
      if (e && typeof e === "object" && "to" in (e as any)) throw e;
      throw redirect({ to: "/auth" });
    }
  },
  component: AuthedLayout,
});

const items = [
   { title: "Generate QR", url: "/generate", icon: QrCode },
   { title: "History", url: "/history", icon: History },
   { title: "API Keys", url: "/api-keys", icon: KeyRound },
   { title: "Settings", url: "/settings", icon: Settings },
];

function AppSidebar() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  async function logout() {
    await supabase.auth.signOut();
    await swalSuccess("Logged out successfully");
    navigate({ to: "/auth", replace: true });
  }

  return (
    <Sidebar
      collapsible="icon"
      style={{
        ["--sidebar" as any]: "#0d4a3a",
        ["--sidebar-foreground" as any]: "#ffffff",
        ["--sidebar-accent" as any]: "rgba(255,255,255,0.15)",
        ["--sidebar-accent-foreground" as any]: "#ffffff",
        ["--sidebar-border" as any]: "rgba(255,255,255,0.1)",
        ["--sidebar-ring" as any]: "rgba(255,255,255,0.3)",
      }}
      className="border-r border-white/10 text-white"
    >
      <SidebarHeader className="px-4 py-5 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center shadow-lg overflow-hidden">
            <img src={logoUrl} alt="AutoUPI" className="w-7 h-7 object-contain" />
          </div>
          <div className="group-data-[collapsible=icon]:hidden">
            <div className="font-bold text-base leading-tight">AutoUPI</div>
            <div className="text-[11px] text-white/60">Payment Gateway</div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-4">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {items.map((item) => {
                const active = pathname === item.url;
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                       asChild
                       tooltip={item.title}
                       className={`group/btn h-10 rounded-lg transition-all duration-300 hover:bg-white/15 hover:translate-x-1 hover:shadow-md ${active ? "bg-white/20 shadow-inner" : ""}`} > <Link to={item.url}> <item.icon className={`w-4 h-4 transition-transform duration-300 group-hover/btn:scale-110 ${active ? "text-white" : "text-white/80"}`} /> <span className="font-medium flex-1">{item.title}</span></Link></SidebarMenuButton></SidebarMenuItem>);})}

               <SidebarMenuItem>
                 <SidebarMenuButton
                   asChild
                   tooltip="Docs"
                   className="group/btn h-10 rounded-lg transition-all duration-300 hover:bg-white/15 hover:translate-x-1"
                 >
                   <a href="/docs" target="_blank" rel="noopener">
                     <FileText className="w-4 h-4 text-white/80 transition-transform duration-300 group-hover/btn:scale-110" />
                     <span className="font-medium">Docs</span>
                   </a>
                 </SidebarMenuButton>
               </SidebarMenuItem>
             </SidebarMenu>
           </SidebarGroupContent>
         </SidebarGroup>
       </SidebarContent>

       <SidebarFooter className="p-2 border-t border-white/10">
         <SidebarMenu>
           <SidebarMenuItem>
             <SidebarMenuButton onClick={logout} tooltip="Sign out" className="h-10 rounded-lg hover:bg-red-500/30 transition-all duration-300">




                <LogOut className="w-4 h-4" />
                <span>Sign out</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
    );
}

function AuthedLayout() {
  return (
    <SidebarProvider>
      <div className="flex w-full min-h-screen bg-gradient-to-br from-[#e8f5ee] via-[#dfeee5] to-[#cfe3d5]">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 flex items-center px-4 border-b border-black/5 bg-white/60 backdrop-blur-sm">
             <SidebarTrigger className="text-[#0d4a3a]" />
          </header>
          <main className="flex-1 p-6 md:p-10">
             <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
