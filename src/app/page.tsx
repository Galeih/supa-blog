import { Suspense } from "react";
import HomeClient from "./home-client";

export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 16 }}>Chargement…</div>}>
      <HomeClient />
    </Suspense>
  );
}