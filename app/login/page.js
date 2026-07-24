"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./login.module.css";

// This is a real page with a real client-side navigation on submit, but
// there is no real authentication behind it — it only checks that both
// fields are non-empty. The point is to exercise a genuine page-load and
// route transition ahead of /dialpad, not to build real auth.
// TODO: real integration — replace this check with a real auth call
// (e.g. against Bolka's own user directory) before this app talks to
// anything beyond the CIF test harness on /dialpad.
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Enter both an email and a password to continue.");
      return;
    }
    setError("");
    router.push("/dialpad");
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <h1 className={styles.title}>Bolka CIF Demo</h1>
        <p className={styles.subtitle}>Sign in to open the dialpad</p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="username"
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
          />

          {error && <div className={styles.error}>{error}</div>}

          <button type="submit" className="primary block">
            Log in
          </button>
        </form>

        <div className={styles.note}>
          No real authentication happens here — any non-empty email and
          password will do. This exists only to exercise a real page load
          and navigation before reaching the CIF test harness at /dialpad.
        </div>
      </div>
    </div>
  );
}
