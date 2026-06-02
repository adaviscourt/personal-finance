import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, Route, Routes } from "react-router-dom";

import { getHealth, previewCsv, type CsvPreviewResponse, type HealthResponse } from "./api/client";
import "./App.css";

function Home() {
  const [apiHealth, setApiHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CsvPreviewResponse | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

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

  async function handlePreviewSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile) {
      setPreviewError("Choose a CSV file first.");
      return;
    }

    setPreviewLoading(true);
    setPreviewError(null);
    setPreview(null);

    try {
      const nextPreview = await previewCsv(selectedFile);
      setPreview(nextPreview);
    } catch {
      setPreviewError("Could not parse that CSV. Check the file and try again.");
    } finally {
      setPreviewLoading(false);
    }
  }

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
      <section className="upload-panel" aria-labelledby="upload-heading">
        <p className="eyebrow">CSV Upload Preview</p>
        <h2 id="upload-heading">Preview source rows before mapping.</h2>
        <form className="upload-form" onSubmit={handlePreviewSubmit}>
          <label className="file-picker">
            <span>Statement CSV</span>
            <input
              accept=".csv,text/csv"
              type="file"
              onChange={(event) => {
                setSelectedFile(event.target.files?.[0] ?? null);
                setPreview(null);
                setPreviewError(null);
              }}
            />
          </label>
          <button type="submit" disabled={previewLoading}>
            {previewLoading ? "Parsing..." : "Preview CSV"}
          </button>
        </form>
        {previewError ? <p className="preview-error">{previewError}</p> : null}
        {preview ? (
          <div className="preview-results">
            <div>
              <h3>Source Columns</h3>
              <div className="column-list" aria-label="Source columns">
                {preview.source_columns.map((column) => (
                  <span key={column}>{column}</span>
                ))}
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {preview.headers.map((header) => (
                      <th key={header} scope="col">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row, index) => (
                    <tr key={index}>
                      {preview.headers.map((header) => (
                        <td key={header}>{row[header] ?? ""}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
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
