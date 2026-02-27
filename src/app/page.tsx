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

export default function HomePage() {
  const { user, isAdmin } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const selectedPostId = params.get("post");

  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);

  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");

  const selectedPost = useMemo(
    () => posts.find((p) => p.id === selectedPostId) ?? null,
    [posts, selectedPostId]
  );

  // Load posts
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

  // Realtime posts (insert/delete)
  useEffect(() => {
    const channel = supabase
      .channel("posts-changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posts" },
        (payload) => {
          const p = payload.new as Post;
          setPosts((prev) => [p, ...prev]);
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "posts" },
        (payload) => {
          const oldRow = payload.old as { id: string };
          setPosts((prev) => prev.filter((p) => p.id !== oldRow.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function createPost() {
    if (!user) return alert("Connecte-toi d’abord.");
    if (!newTitle.trim() || !newContent.trim()) return;

    const { error } = await supabase.from("posts").insert({
      user_id: user.id,
      title: newTitle.trim(),
      content: newContent.trim(),
    });

    if (error) alert(error.message);
    else {
      setNewTitle("");
      setNewContent("");
    }
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
    <main style={{ maxWidth: 920, margin: "24px auto", padding: 16 }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <h1 style={{ margin: 0 }}>Posts</h1>
          <Link href="/stats">Stats</Link>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {user ? (
            <>
              <span>{user.email}</span>
              <button onClick={logout}>Logout</button>
            </>
          ) : (
            <Link href="/auth">Login / Signup</Link>
          )}
        </div>
      </header>

      <section style={{ marginTop: 20, padding: 12, border: "1px solid #ddd" }}>
        <h2 style={{ marginTop: 0 }}>Créer un post</h2>
        <input
          placeholder="Titre"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
        />
        <textarea
          placeholder="Contenu"
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          rows={4}
        />
        <button onClick={createPost} disabled={!user}>
          Publier
        </button>
        {!user && <p>Tu dois être connecté pour publier (RLS).</p>}
      </section>

      <section style={{ marginTop: 20 }}>
        {loadingPosts ? (
          <p>Chargement…</p>
        ) : (
          posts.map((p) => (
            <article
              key={p.id}
              style={{ padding: 12, border: "1px solid #ddd", marginBottom: 12 }}
            >
              <h3 style={{ margin: "0 0 6px 0" }}>{p.title}</h3>
              <p style={{ margin: "0 0 10px 0", opacity: 0.8 }}>
                {new Date(p.created_at).toLocaleString()}
              </p>
              <p style={{ margin: "0 0 10px 0" }}>
                {p.content.length > 160 ? p.content.slice(0, 160) + "…" : p.content}
              </p>

              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => router.push(`/?post=${p.id}`)}>Ouvrir</button>
                {isAdmin && <button onClick={() => deletePost(p.id)}>Supprimer</button>}
              </div>
            </article>
          ))
        )}
      </section>

      {selectedPostId && (
        <PostModal
          postId={selectedPostId}
          post={selectedPost}
          isAdmin={isAdmin}
          onClose={() => router.push("/")}
          onDeletePost={deletePost}
        />
      )}
    </main>
  );
}

function PostModal({
  postId,
  post,
  isAdmin,
  onClose,
  onDeletePost,
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

  // Load comments
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

  // Realtime comments for this post (insert/delete)
  useEffect(() => {
    const channel = supabase
      .channel(`comments-${postId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "comments", filter: `post_id=eq.${postId}` },
        (payload) => {
          setComments((prev) => [...prev, payload.new as Comment]);
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "comments", filter: `post_id=eq.${postId}` },
        (payload) => {
          const oldRow = payload.old as { id: string };
          setComments((prev) => prev.filter((c) => c.id !== oldRow.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [postId]);

  async function addComment() {
    if (!user) return alert("Connecte-toi d’abord.");
    if (!newComment.trim()) return;

    const { error } = await supabase.from("comments").insert({
      user_id: user.id,
      post_id: postId,
      content: newComment.trim(),
    });

    if (error) alert(error.message);
    else setNewComment("");
  }

  async function deleteComment(id: string) {
    const { error } = await supabase.from("comments").delete().eq("id", id);
    if (error) alert(error.message);
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "grid",
        placeItems: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{ background: "white", width: "min(900px, 100%)", padding: 16 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <h2 style={{ margin: 0 }}>{post?.title ?? "Post"}</h2>
          <button onClick={onClose}>Fermer</button>
        </div>

        {post && (
          <>
            <p style={{ opacity: 0.8 }}>{new Date(post.created_at).toLocaleString()}</p>
            <p>{post.content}</p>
            {isAdmin && (
              <button onClick={() => onDeletePost(post.id)} style={{ marginBottom: 12 }}>
                Supprimer le post
              </button>
            )}
          </>
        )}

        <hr />

        <h3>Commentaires</h3>
        {comments.map((c) => (
          <div key={c.id} style={{ border: "1px solid #ddd", padding: 10, marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <span style={{ opacity: 0.8 }}>{new Date(c.created_at).toLocaleString()}</span>
              {isAdmin && <button onClick={() => deleteComment(c.id)}>Supprimer</button>}
            </div>
            <p style={{ margin: "6px 0 0 0" }}>{c.content}</p>
          </div>
        ))}

        <textarea
          placeholder="Écrire un commentaire…"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          rows={3}
        />
        <button onClick={addComment} disabled={!user}>
          Commenter
        </button>
        {!user && <p>Tu dois être connecté pour commenter (RLS).</p>}
      </div>
    </div>
  );
}