import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";
const repo = "REPO_NAME"; // <= remplace par le nom du repo GitHub

const nextConfig: NextConfig = {
  output: "export", // static export :contentReference[oaicite:3]{index=3}
  images: { unoptimized: true }, // l'optimisation d'images nécessite un serveur :contentReference[oaicite:4]{index=4}
  trailingSlash: true, // pratique sur GH Pages :contentReference[oaicite:5]{index=5}
  basePath: isProd ? `/${repo}` : "", // GH Pages sert sur /<repo> :contentReference[oaicite:6]{index=6}
  assetPrefix: isProd ? `/${repo}/` : "",
};

export default nextConfig;