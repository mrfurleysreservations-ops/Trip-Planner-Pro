import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function FriendsPage() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto", padding: "16px 16px" }}>
      <h2 style={{
        fontFamily: "'Outfit', sans-serif",
        fontWeight: 800,
        fontSize: "22px",
        letterSpacing: "-0.02em",
        marginBottom: "16px",
        color: "#1a1a1a",
      }}>
        Friends
      </h2>
      <div style={{
        background: "#fff",
        border: "1.5px solid #e5e5e5",
        borderRadius: "14px",
        padding: "48px",
        textAlign: "center",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}>
        <div style={{ fontSize: "42px", marginBottom: "10px" }}>👥</div>
        <p style={{ color: "#777", fontSize: "15px" }}>
          Friends system coming soon! You'll be able to add friends, manage family connections, and invite people to trips.
        </p>
      </div>
    </div>
  );
}
