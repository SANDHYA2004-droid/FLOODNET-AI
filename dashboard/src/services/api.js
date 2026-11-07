
const API_BASE_URL = "http://127.0.0.1:8000";

// --------------------------------------------------
// DASHBOARD SUMMARY
// --------------------------------------------------

export async function fetchSummary() {
  const response = await fetch(
    `${API_BASE_URL}/api/summary`
  );

  if (!response.ok) {
    throw new Error(
      "Unable to load dashboard summary."
    );
  }

  return response.json();
}


// --------------------------------------------------
// INDIVIDUAL 100m GRID FEATURES
// --------------------------------------------------

export async function fetchMapFeatures(bounds) {
  const params = new URLSearchParams({
    west: bounds.west,
    south: bounds.south,
    east: bounds.east,
    north: bounds.north,
  });

  const response = await fetch(
    `${API_BASE_URL}/api/map/features?${params.toString()}`
  );

  if (!response.ok) {
    throw new Error(
      "Unable to load Chennai map features."
    );
  }

  return response.json();
}


// --------------------------------------------------
// CITYWIDE SPATIAL OVERVIEW
// --------------------------------------------------

export async function fetchMapOverview() {
  const response = await fetch(
    `${API_BASE_URL}/api/map/overview`
  );

  if (!response.ok) {
    throw new Error(
      "Unable to load Chennai investigation overview."
    );
  }

  return response.json();
}


// --------------------------------------------------
// GCC WARD INVESTIGATION RANKING
// --------------------------------------------------

export async function fetchWardRanking() {
  const response = await fetch(
    `${API_BASE_URL}/api/wards/ranking`
  );

  if (!response.ok) {
    let errorMessage =
      "Unable to load GCC ward investigation rankings.";

    try {
      const errorData = await response.json();

      if (errorData.detail) {
        errorMessage = errorData.detail;
      }
    } catch {
      // Keep the default error message.
    }

    throw new Error(errorMessage);
  }

  const data = await response.json();

  if (
    !data ||
    !Array.isArray(data.features) ||
    !Array.isArray(data.ranking)
  ) {
    throw new Error(
      "Invalid GCC ward ranking response."
    );
  }

  return data;
}
