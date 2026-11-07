
import {
  Grid3X3,
  MapPin,
  AlertTriangle,
  Layers3,
} from "lucide-react";

function SummaryCards({ summary }) {
  if (!summary) return null;

  const cards = [
    {
      title: "Total Grid Cells",
      value: summary.total_grid_cells,
      description: "100m spatial grid",
      icon: Grid3X3,
    },
    {
      title: "Positive Score Cells",
      value: summary.positive_score_cells,
      description: "Cells with non-zero ranking scores",
      icon: MapPin,
    },
    {
      title: "Recorded Evidence",
      value: summary.recorded_positive_evidence_cells,
      description: "Cells with recorded positive evidence",
      icon: AlertTriangle,
    },
    {
      title: "Unlabelled Cells",
      value: summary.unlabelled_cells,
      description: "Not verified as flood-free",
      icon: Layers3,
    },
  ];

  return (
    <section className="summary-grid">
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <article className="summary-card" key={card.title}>
            <div className="summary-card-top">
              <span>{card.title}</span>
              <Icon size={21} />
            </div>

            <h2>{Number(card.value).toLocaleString("en-IN")}</h2>

            <p>{card.description}</p>
          </article>
        );
      })}
    </section>
  );
}

export default SummaryCards;
