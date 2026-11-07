
import { Waves, Activity, MapPin } from "lucide-react";

function Header() {
  return (
    <header className="dashboard-header">
      <div className="header-brand">
        <div className="brand-icon">
          <Waves size={27} />
        </div>

        <div>
          <h1>FLOODNET-AI</h1>
          <p>Chennai Spatial Flood Intelligence</p>
        </div>
      </div>

      <div className="header-status">
        <span className="status-indicator"></span>
        <span>Intelligence Dashboard</span>
      </div>

      <div className="header-location">
        <MapPin size={17} />
        <span>Chennai Metropolitan Area</span>
      </div>
    </header>
  );
}

export default Header;
