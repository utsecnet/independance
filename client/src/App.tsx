import { useState } from "react";
import { TopBar } from "./components/layout/TopBar/TopBar";
import { LeftSubMenu } from "./components/layout/LeftSubMenu/LeftSubMenu";
import { GraphCanvas } from "./components/layout/RightPane/GraphCanvas";
import { SettingsBlade } from "./components/layout/Settings/SettingsBlade";
import { ErrorBanner } from "./components/layout/ErrorBanner/ErrorBanner";
import styles from "./App.module.css";

const MAP_FILTERS = ["All", "Tasks", "Projects", "POA&Ms"];

function App() {
  const [activeFilter, setActiveFilter] = useState("All");
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className={styles.shell}>
      <TopBar />
      <div className={styles.body}>
        <LeftSubMenu
          heading="Map"
          items={MAP_FILTERS}
          activeItem={activeFilter}
          onSelectItem={setActiveFilter}
          settingsActive={settingsOpen}
          onToggleSettings={() => setSettingsOpen((v) => !v)}
        />
        <div className={styles.mapArea}>
          <GraphCanvas />
          <SettingsBlade open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        </div>
      </div>
      <ErrorBanner />
    </div>
  );
}

export default App;
