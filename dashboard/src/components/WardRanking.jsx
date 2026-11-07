
import { useMemo, useState } from "react";

function WardRanking({ data, loading, error }) {
  const [showAll, setShowAll] = useState(false);

  const wards = useMemo(() => {
    if (!data) return [];

    // Prefer the ranking list; fall back to GeoJSON feature properties.
    const source = Array.isArray(data.ranking)
      ? data.ranking
      : Array.isArray(data.features)
        ? data.features.map((feature) => feature.properties || {})
        : [];

    return source
      .map((item) => item.properties || item)
      .sort((a, b) => {
        const rankA = Number(a.investigation_rank ?? a.rank ?? Infinity);
        const rankB = Number(b.investigation_rank ?? b.rank ?? Infinity);

        if (rankA !== rankB) return rankA - rankB;

        return (
          Number(b.higher_priority_percentage || 0) -
          Number(a.higher_priority_percentage || 0)
        );
      });
  }, [data]);

  const displayedWards = showAll ? wards : wards.slice(0, 10);

  if (loading) {
    return (
      <section className="ward-ranking-section">
        <h2>GCC Ward Investigation Ranking</h2>
        <p>Loading ward ranking data...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="ward-ranking-section">
        <h2>GCC Ward Investigation Ranking</h2>
        <p className="ward-error">{error}</p>
      </section>
    );
  }

  if (!wards.length) {
    return (
      <section className="ward-ranking-section">
        <h2>GCC Ward Investigation Ranking</h2>
        <p>No ward ranking records are available.</p>
      </section>
    );
  }

  return (
    <section className="ward-ranking-section">
      <div className="ward-ranking-heading">
        <div>
          <h2>GCC Ward Investigation Ranking</h2>
          <p>
            Wards are automatically ranked using the share of grid cells
            in Positive Tier 4 and Positive Tier 5.
          </p>
        </div>

        <span className="ward-count">
          {wards.length} wards
        </span>
      </div>

      <div className="ward-ranking-note">
        This is a relative investigation-priority ranking, not a calibrated
        flood-risk measurement. A higher percentage does not prove that
        flooding has occurred.
      </div>

      <div className="ward-ranking-table-wrapper">
        <table className="ward-ranking-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Ward</th>
              <th>Zone</th>
              <th>Higher-priority cells</th>
              <th>Share</th>
              <th>Recorded evidence cells</th>
            </tr>
          </thead>

          <tbody>
            {displayedWards.map((ward, index) => {
              const rank =
                ward.investigation_rank ?? ward.rank ?? index + 1;

              const wardNumber =
                ward.ward ?? ward.ward_number ?? ward.ward_id ?? "—";

              const zone = ward.zone ?? "—";

              const count = Number(ward.higher_priority_count || 0);
              const total = Number(ward.total_cells || 0);
              const percentage = Number(
                ward.higher_priority_percentage || 0
              );
              const evidence = Number(
                ward.recorded_positive_evidence_cells || 0
              );

              return (
                <tr key={`${ward.ward_id ?? wardNumber}-${zone}`}>
                  <td>
                    <span className="ward-rank-number">{rank}</span>
                  </td>

                  <td>
                    <strong>{wardNumber}</strong>
                  </td>

                  <td>{zone}</td>

                  <td>
                    {count.toLocaleString("en-IN")} /{" "}
                    {total.toLocaleString("en-IN")}
                  </td>

                  <td>
                    <div className="ward-percentage-cell">
                      <div className="ward-progress-track">
                        <div
                          className="ward-progress-fill"
                          style={{
                            width: `${Math.min(
                              Math.max(percentage, 0),
                              100
                            )}%`,
                          }}
                        />
                      </div>

                      <strong>{percentage.toFixed(1)}%</strong>
                    </div>
                  </td>

                  <td>{evidence.toLocaleString("en-IN")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {wards.length > 10 && (
        <button
          type="button"
          className="ward-show-more-button"
          onClick={() => setShowAll((previous) => !previous)}
        >
          {showAll ? "Show Top 10 Wards" : "View All 200 Wards"}
        </button>
      )}

      <p className="ward-ranking-footer">
        Ranking coverage is limited to grid cells assigned to the 200
        Greater Chennai Corporation ward boundaries. Areas outside
        GCC ward coverage are not ranked in this table.
      </p>
    </section>
  );
}

export default WardRanking;
