
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

function RankingChart({ summary }) {
  if (!summary) return null;

  const tierCounts = summary.ranking_tier_counts || {};

  const chartData = [
    {
      tier: "Zero score",
      cells: tierCounts["Zero-score group"] || 0,
    },
    {
      tier: "Tier 1",
      cells: tierCounts["Positive Tier 1"] || 0,
    },
    {
      tier: "Tier 2",
      cells: tierCounts["Positive Tier 2"] || 0,
    },
    {
      tier: "Tier 3",
      cells: tierCounts["Positive Tier 3"] || 0,
    },
    {
      tier: "Tier 4",
      cells: tierCounts["Positive Tier 4"] || 0,
    },
    {
      tier: "Tier 5",
      cells: tierCounts["Positive Tier 5"] || 0,
    },
  ];

  return (
    <section className="chart-panel">
      <div className="panel-heading">
        <div>
          <h2>Spatial Ranking Distribution</h2>
          <p>Grid cells grouped by relative ranking tier</p>
        </div>
      </div>

      <div className="chart-container">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart
            data={chartData}
            margin={{ top: 15, right: 15, left: 10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />

            <XAxis dataKey="tier" />

            <YAxis
              tickFormatter={(value) =>
                `${(value / 1000).toFixed(0)}k`
              }
            />

            <Tooltip
              formatter={(value) => [
                Number(value).toLocaleString("en-IN"),
                "Grid cells",
              ]}
            />

            <Bar
              dataKey="cells"
              fill="#278b83"
              radius={[6, 6, 0, 0]}
              maxBarSize={55}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

export default RankingChart;
