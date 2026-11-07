
import { useEffect, useState } from "react";

import Header from "./components/Header";
import SummaryCards from "./components/SummaryCards";
import RankingChart from "./components/RankingChart";
import FloodMap from "./components/FloodMap";
import CellDetails from "./components/CellDetails";
import WardRanking from "./components/WardRanking";

import {
  fetchSummary,
  fetchWardRanking,
} from "./services/api";

import "./App.css";

function App() {
  const [summary, setSummary] = useState(null);
  const [selectedCell, setSelectedCell] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [wardRanking, setWardRanking] = useState(null);
  const [wardLoading, setWardLoading] = useState(true);
  const [wardError, setWardError] = useState("");

  // Load the main dashboard summary.
  useEffect(() => {
    async function loadDashboard() {
      try {
        const data = await fetchSummary();
        setSummary(data);
      } catch (err) {
        setError(
          err.message || "Unable to connect to the backend."
        );
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  // Load GCC ward investigation rankings independently.
  useEffect(() => {
    async function loadWardRanking() {
      try {
        const data = await fetchWardRanking();
        setWardRanking(data);
      } catch (err) {
        setWardError(
          err.message || "Unable to load GCC ward rankings."
        );
      } finally {
        setWardLoading(false);
      }
    }

    loadWardRanking();
  }, []);

  // Main dashboard loading state.
  if (loading) {
    return (
      <main className="app-loading">
        <h2>FLOODNET-AI</h2>
        <p>Loading Chennai flood intelligence...</p>
      </main>
    );
  }

  // Main dashboard connection error.
  if (error) {
    return (
      <main className="app-error">
        <h2>Dashboard Connection Error</h2>
        <p>{error}</p>
        <p>
          Check whether the FastAPI backend is running
          on port 8000.
        </p>
      </main>
    );
  }

  return (
    <div className="app-container">
      <Header />

      <main className="dashboard-main">

        {/* Dashboard introduction */}
        <section className="welcome-section">
          <div>
            <p className="eyebrow">
              SPATIAL FLOOD INTELLIGENCE
            </p>

            <h2>Chennai Flood Evidence Dashboard</h2>

            <p>
              Explore spatial ranking results, recorded flood
              evidence, and geographic characteristics across
              the study area.
            </p>
          </div>

          <div className="model-status">
            <span className="status-indicator"></span>
            Ranking model results loaded
          </div>
        </section>

        {/* Overall dashboard statistics */}
        <SummaryCards summary={summary} />

        {/* Automatic GCC ward investigation ranking */}
        <WardRanking
          data={wardRanking}
          loading={wardLoading}
          error={wardError}
        />

        {/* Ranking chart and selected grid-cell details */}
        <div className="dashboard-grid">
          <RankingChart summary={summary} />

          <CellDetails cell={selectedCell} />
        </div>

        {/* Interactive spatial flood map */}
        <FloodMap
  onCellSelect={setSelectedCell}
  wardData={wardRanking}
/>

        {/* Scientific limitations */}
        <footer className="dashboard-footer">
          <p>
            FLOODNET-AI · Chennai Metropolitan Area ·
            Spatial ranking based on available evidence
          </p>

          <p>
            Model scores are uncalibrated ranking scores,
            not flood probabilities or confirmed flood predictions.
          </p>

          <p>
            GCC ward rankings cover only grid cells assigned
            to Greater Chennai Corporation ward boundaries.
            Areas outside this coverage are not ranked in
            the ward table.
          </p>
        </footer>

      </main>
    </div>
  );
}

export default App;
