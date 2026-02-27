"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

type Post = {
  id: string;
  user_id: string;
  title: string;
  content: string;
  created_at: string;
};

type Comment = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
};

function useHitCounter() {
  const [count, setCount] = useState(41337);
  useEffect(() => {
    try {
      const stored = parseInt(localStorage.getItem("hitcount") || "0", 10);
      const base = stored || Math.floor(Math.random() * 10000) + 38000;
      const next = base + 1;
      localStorage.setItem("hitcount", String(next));
      setCount(next);
    } catch {}
  }, []);
  return count.toString().padStart(6, "0");
}

export default function HomeClient() {
  const { user, isAdmin } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const selectedPostId = params.get("post");
  const hitCount = useHitCounter();

  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");

  const selectedPost = useMemo(
    () => posts.find((p) => p.id === selectedPostId) ?? null,
    [posts, selectedPostId]
  );

  useEffect(() => {
    (async () => {
      setLoadingPosts(true);
      const { data, error } = await supabase
        .from("posts")
        .select("id,user_id,title,content,created_at")
        .order("created_at", { ascending: false });
      if (!error && data) setPosts(data);
      setLoadingPosts(false);
    })();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("posts-changes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts" }, (payload) => {
        setPosts((prev) => [payload.new as Post, ...prev]);
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "posts" }, (payload) => {
        const old = payload.old as { id: string };
        setPosts((prev) => prev.filter((p) => p.id !== old.id));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  async function createPost() {
    if (!user) return alert("Connecte-toi d'abord.");
    if (!newTitle.trim() || !newContent.trim()) return;
    const { error } = await supabase.from("posts").insert({
      user_id: user.id,
      title: newTitle.trim(),
      content: newContent.trim(),
    });
    if (error) alert(error.message);
    else { setNewTitle(""); setNewContent(""); }
  }

  async function deletePost(id: string) {
    const { error } = await supabase.from("posts").delete().eq("id", id);
    if (error) alert(error.message);
    router.push("/");
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <div className="site-wrapper">

      {/* ── Marquee banner ── */}
      <div className="marquee-bar">
        <span className="marquee-inner">
          ✦ Bienvenue sur mon blog ! ✦ &nbsp;&nbsp;&nbsp;
          Dernière mise à jour : {new Date().toLocaleDateString("fr-FR")} &nbsp;&nbsp;&nbsp;
          ✦ Best viewed in Internet Explorer 6.0 ✦ &nbsp;&nbsp;&nbsp;
          1024x768 recommended &nbsp;&nbsp;&nbsp;
          ✦ Sign my guestbook! ✦ &nbsp;&nbsp;&nbsp;
          No hotlinking please! &nbsp;&nbsp;&nbsp;
          ✦ Free to use with credit ✦ &nbsp;&nbsp;&nbsp;
        </span>
      </div>

      {/* ── Topbar ── */}
      <header className="topbar">
        <div className="brand">
          <h1>⚡ Supabase Blog</h1>
          <Link href="/stats" className="badge">📊 Stats</Link>
          {isAdmin && <span className="badge">🛡️ Admin</span>}
        </div>
        <div className="nav">
          {user ? (
            <>
              <span className="muted" style={{ fontSize: 10 }}>{user.email}</span>
              <button className="btnGhost" onClick={logout}>[ Logout ]</button>
            </>
          ) : (
            <Link className="badge" href="/auth">[ Login / Signup ]</Link>
          )}
        </div>
      </header>

      {/* ── Body ── */}
      <div className="site-body">

        {/* ════ MAIN ════ */}
        <div className="main-col">

          {/* New post */}
          <div className="card">
            <div className="card-header">✏️ Nouveau billet</div>
            <div className="card-body">
              <input
                placeholder="Titre du billet..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
              <textarea
                placeholder="Contenu du billet..."
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                rows={4}
              />
              <div className="actions" style={{ marginTop: 4 }}>
                <button className="btnPrimary" onClick={createPost} disabled={!user}>
                  ▶ Publier
                </button>
                {!user && (
                  <span className="muted" style={{ fontSize: 10, alignSelf: "center" }}>
                    &nbsp;⚠ Connexion requise (RLS)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Posts */}
          <div className="card">
            <div className="card-header">📜 Les billets ({posts.length})</div>
            <div className="card-body" style={{ padding: "6px 10px" }}>
              <div className="grid">
                {loadingPosts ? (
                  <p className="muted" style={{ padding: 8 }}>
                    <span className="blinking-text">■</span> Chargement des billets…
                  </p>
                ) : posts.length === 0 ? (
                  <p className="muted" style={{ padding: 8 }}>Aucun billet pour le moment.</p>
                ) : (
                  posts.map((p) => (
                    <article key={p.id} className="postCard">
                      <h3 className="postTitle">{p.title}</h3>
                      <p className="postMeta">
                        Posté le {new Date(p.created_at).toLocaleString("fr-FR")}
                      </p>
                      <p className="postExcerpt">
                        {p.content.length > 200 ? p.content.slice(0, 200) + "…" : p.content}
                      </p>
                      <div className="actions">
                        <button className="btnPrimary" onClick={() => router.push(`/?post=${p.id}`)}>
                          ▶ Lire la suite
                        </button>
                        {isAdmin && (
                          <button className="btnDanger" onClick={() => deletePost(p.id)}>
                            ✕ Supprimer
                          </button>
                        )}
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ════ SIDEBAR ════ */}
        <aside className="sidebar">

          <div className="widget">
            <div className="widget-title">👤 À propos</div>
            <div className="widget-body">
              <div style={{ textAlign: "center", marginBottom: 8 }}>
                <div style={{
                  width: 60, height: 60, margin: "0 auto 6px",
                  background: "linear-gradient(135deg, #3344aa, #6622cc)",
                  border: "3px outset #8899cc",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 28,
                }}>🧑‍💻</div>
                <strong style={{ color: "#6699ff" }}>BlogMaster3000</strong>
              </div>
              <p style={{ margin: "4px 0", fontSize: 10, color: "#8899cc" }}>
                Passionné de tech, musique et ramen 🍜
              </p>
              <div className="star-divider">✦ ✦ ✦</div>
              <p style={{ margin: 0, fontSize: 10 }}>
                <span className="online-dot" />
                <span style={{ color: "#00ff00" }}>En ligne !</span>
              </p>
            </div>
          </div>

          <div className="widget">
            <div className="widget-title">📊 Visiteurs</div>
            <div className="widget-body" style={{ textAlign: "center" }}>
              <div className="hit-counter">{hitCount}</div>
              <p style={{ margin: "4px 0 0", fontSize: 10, color: "#8899cc" }}>
                visiteurs depuis 2003
              </p>
            </div>
          </div>

          <div className="widget">
            <div className="widget-title">🔗 Liens amis</div>
            <div className="widget-body">
              <a href="#">💾 CoolSite2003</a>
              <a href="#">🌐 xXxBlogXxX</a>
              <a href="#">🎮 GameZone.net</a>
              <a href="#">🎵 MP3Palace</a>
              <a href="#">📷 PhotoBlog</a>
            </div>
          </div>

          <div className="widget">
            <div className="widget-title">😊 Humeur</div>
            <div className="widget-body" style={{ textAlign: "center" }}>
              <div style={{ fontSize: 32 }}>😎</div>
              <p style={{ margin: 0, fontSize: 11 }}>
                <em style={{ color: "#cc88ff" }}>Heureux et productif</em>
              </p>
              <p style={{ margin: "4px 0 0", fontSize: 10, color: "#8899cc" }}>
                Écoute : Daft Punk 🎵
              </p>
            </div>
          </div>

          <div className="widget">
            <div className="widget-title">🗂 Catégories</div>
            <div className="widget-body">
              <a href="#">📰 Actus (12)</a>
              <a href="#">💻 Tech (8)</a>
              <a href="#">🎮 Gaming (5)</a>
              <a href="#">🎵 Musique (3)</a>
              <a href="#">😂 LOL (9)</a>
            </div>
          </div>

          <div style={{ marginTop: 10 }}>
            <div style={{
              background: "linear-gradient(90deg, #000066, #0000cc)",
              border: "2px outset #6699ff",
              textAlign: "center",
              padding: "6px 4px",
              color: "#ffcc00",
              fontWeight: "bold",
              letterSpacing: 1,
              fontFamily: "'VT323', monospace",
              fontSize: "13px",
            }}>
              ✨ BEST VIEWED IN<br />1024×768 ✨
            </div>
          </div>

        </aside>
      </div>

      {/* Footer */}
      <footer className="site-footer">
        <div className="star-divider">✦ ✦ ✦ ✦ ✦</div>
        © {new Date().getFullYear()} BlogMaster3000 — Tous droits réservés
        &nbsp;·&nbsp; Fait avec ❤️ et &lt;table&gt;
        &nbsp;·&nbsp; <a href="#">Livre d'or</a>
        &nbsp;·&nbsp; <a href="#">Contact</a>
      </footer>

      {/* Modal */}
      {selectedPostId && (
        <PostModal
          postId={selectedPostId}
          post={selectedPost}
          isAdmin={isAdmin}
          onClose={() => router.push("/")}
          onDeletePost={deletePost}
        />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════ */

function PostModal({
  postId, post, isAdmin, onClose, onDeletePost,
}: {
  postId: string;
  post: Post | null;
  isAdmin: boolean;
  onClose: () => void;
  onDeletePost: (id: string) => void;
}) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("comments")
        .select("id,post_id,user_id,content,created_at")
        .eq("post_id", postId)
        .order("created_at", { ascending: true });
      if (data) setComments(data);
    })();
  }, [postId]);

  useEffect(() => {
    const channel = supabase
      .channel(`comments-${postId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "comments",
        filter: `post_id=eq.${postId}`,
      }, (payload) => setComments((prev) => [...prev, payload.new as Comment]))
      .on("postgres_changes", {
        event: "DELETE", schema: "public", table: "comments",
        filter: `post_id=eq.${postId}`,
      }, (payload) => {
        const old = payload.old as { id: string };
        setComments((prev) => prev.filter((c) => c.id !== old.id));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [postId]);

  async function addComment() {
    if (!user) return alert("Connecte-toi d'abord.");
    if (!newComment.trim()) return;
    const { error } = await supabase.from("comments").insert({
      user_id: user.id, post_id: postId, content: newComment.trim(),
    });
    if (error) alert(error.message);
    else setNewComment("");
  }

  async function deleteComment(id: string) {
    const { error } = await supabase.from("comments").delete().eq("id", id);
    if (error) alert(error.message);
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>

        {/* Windows title bar */}
        <div className="modal-title-bar">
          <span>🗒 {post?.title ?? "Billet"}</span>
          <div className="win-buttons">
            <button className="win-btn" onClick={onClose} title="Fermer">✕</button>
          </div>
        </div>

        {/* Post */}
        {post && (
          <div className="modal-body">
            <div className="card-header" style={{ marginBottom: 8 }}>
              📅 {new Date(post.created_at).toLocaleString("fr-FR")}
            </div>
            <p style={{ fontSize: 12, lineHeight: 1.7, margin: "0 0 10px" }}>{post.content}</p>
            {isAdmin && (
              <button className="btnDanger" onClick={() => onDeletePost(post.id)}>
                ✕ Supprimer ce billet
              </button>
            )}
          </div>
        )}

        <hr className="hr" style={{ margin: 0 }} />

        {/* Comments */}
        <div className="modal-body">
          <div className="card-header" style={{ marginBottom: 10 }}>
            💬 Commentaires ({comments.length})
          </div>

          {comments.length === 0 && (
            <p className="muted" style={{ fontSize: 11 }}>Sois le premier à commenter ! 😊</p>
          )}

          {comments.map((c) => (
            <div key={c.id} className="comment">
              <div className="commentTop">
                <span className="muted" style={{ fontSize: 10 }}>
                  📅 {new Date(c.created_at).toLocaleString("fr-FR")}
                </span>
                {isAdmin && (
                  <button className="btnDanger" style={{ fontSize: 10, padding: "2px 6px" }} onClick={() => deleteComment(c.id)}>
                    ✕
                  </button>
                )}
              </div>
              <p style={{ margin: "4px 0 0", fontSize: 11 }}>{c.content}</p>
            </div>
          ))}

          <div className="star-divider">✦ Laisser un commentaire ✦</div>

          <textarea
            placeholder="Écris ton commentaire ici... (sois sympa !)"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            rows={3}
          />
          <div className="actions">
            <button className="btnPrimary" onClick={addComment} disabled={!user}>
              ▶ Commenter
            </button>
            {!user && (
              <span className="muted" style={{ fontSize: 10, alignSelf: "center" }}>
                &nbsp;⚠ Connexion requise
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}