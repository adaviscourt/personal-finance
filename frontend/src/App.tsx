import { useEffect, useState } from "react";
import { Link, Route, Routes } from "react-router-dom";

import { getHealth, type HealthResponse } from "./api/client";
import "./App.css";

function Home() {
  const [apiHealth, setApiHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    getHealth()
      .then((health) => {
        if (active) {
          setApiHealth(health);
        }
      })
      .catch(() => {
        if (active) {
          setError("API unavailable");
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="app-shell">
      <section className="hero">
        <p className="eyebrow">Personal Finance MVP</p>
        <h1>Import messy CSVs into useful money data.</h1>
        <p className="intro">
          The foundation is running: React on Vite, FastAPI on SQLite, and Docker for local development.
        </p>
        <div className="status-card" aria-label="Frontend Health">
          <span className="status-label">Frontend Health</span>
          <span className="status-value ok">ready</span>
          <span className="status-label">Backend Health</span>
          <span className={error ? "status-value error" : "status-value ok"}>
            {error ?? apiHealth?.status ?? "checking"}
          </span>
        </div>
      </section>
    </main>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="*" element={<Link to="/">Back to dashboard</Link>} />
    </Routes>
  );
}
