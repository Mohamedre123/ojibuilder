"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PromoBanner from "@/components/PromoBanner";
import { getSupabase } from "@/lib/supabase/client";
import { authEnabled } from "@/lib/supabase/config";

interface Item {
  id: string;
  title: string;
  ts: number;
}

export default function Projects() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const sb = getSupabase();
      if (authEnabled && sb) {
        const { data: u } = await sb.auth.getUser();
        if (!u.user) {
          router.replace("/login?returnTo=/projects");
          return;
        }
        const { data } = await sb
          .from("projects")
          .select("id,title,updated_at")
          .order("updated_at", { ascending: false });
        setItems(
          (data || []).map((r: { id: string; title: string; updated_at: string }) => ({
            id: r.id,
            title: r.title,
            ts: new Date(r.updated_at).getTime(),
          }))
        );
      } else {
        try {
          const raw = localStorage.getItem("oji:projects");
          setItems(raw ? JSON.parse(raw) : []);
        } catch {
          setItems([]);
        }
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function remove(id: string) {
    const next = items.filter((p) => p.id !== id);
    setItems(next);
    const sb = getSupabase();
    if (authEnabled && sb) {
      await sb.from("projects").delete().eq("id", id);
    } else {
      localStorage.setItem("oji:projects", JSON.stringify(next));
    }
  }

  return (
    <>
      <PromoBanner />
      <main className="min-h-screen max-w-3xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-extrabold">مشاريعي</h1>
          <button onClick={() => router.push("/")} className="text-sm text-[var(--oji-muted)] hover:text-white transition">+ مشروع جديد</button>
        </div>

        {loading ? (
          <div className="text-center text-[var(--oji-muted)] py-20">جارٍ التحميل...</div>
        ) : items.length === 0 ? (
          <div className="text-center text-[var(--oji-muted)] py-20">
            لا توجد مشاريع محفوظة بعد.
            <div className="mt-4">
              <button onClick={() => router.push("/")} className="px-5 py-2.5 rounded-xl font-bold bg-gradient-to-l from-[var(--oji-primary)] to-[var(--oji-primary-strong)] text-[#06121f]">ابنِ موقعك الأول</button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-2xl oji-glass p-4">
                <div className="min-w-0">
                  <div className="font-bold truncate">{p.title}</div>
                  <div className="text-xs text-[var(--oji-muted)]">آخر حفظ: {new Date(p.ts).toLocaleString("ar-EG")}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => router.push(`/builder?project=${p.id}`)} className="px-4 py-2 rounded-lg bg-gradient-to-l from-[var(--oji-primary)] to-[var(--oji-primary-strong)] text-[#06121f] font-bold text-sm">فتح</button>
                  <button onClick={() => remove(p.id)} className="px-3 py-2 rounded-lg border border-[var(--oji-border)] text-sm hover:border-red-500 hover:text-red-300 transition">حذف</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
