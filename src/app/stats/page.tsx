"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Stats = {
  total_posts: number;
  avg_comments_per_post: number;
  avg_posts_per_user: number;
};

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("get_blog_stats").single();
      if (error) setErr(error.message);
      else setStats(data as Stats);
    })();
  }, []);

  return (
    <main style={{ maxWidth: 720, margin: "24px auto", padding: 16 }}>
      <header style={{ display: "flex", justifyContent: "space-between" }}>
        <h1 style={{ margin: 0 }}>Stats</h1>
        <Link href="/">← Retour</Link>
      </header>

      {err && <p>{err}</p>}
      {!stats ? (
        <p>Chargement…</p>
      ) : (
        <ul>
          <li>Total posts : {stats.total_posts}</li>
          <li>Moy. commentaires / post : {Number(stats.avg_comments_per_post).toFixed(2)}</li>
          <li>Moy. posts / utilisateur : {Number(stats.avg_posts_per_user).toFixed(2)}</li>
        </ul>
      )}
    </main>
  );
}