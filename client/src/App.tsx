import { useState } from "react";
import { TopBar } from "./components/layout/TopBar/TopBar";
import { LeftSubMenu } from "./components/layout/LeftSubMenu/LeftSubMenu";
import { GraphCanvas } from "./components/layout/RightPane/GraphCanvas";
import { ErrorBanner } from "./components/layout/ErrorBanner/ErrorBanner";
import styles from "./App.module.css";

const TOP_SECTIONS = ["Map", "Settings"];
const SUBMENU_ITEMS: Record<string, string[]> = {
  Map: ["All", "Tasks", "Projects", "POA&Ms"],
  Settings: ["Appearance", "Data"],
};

function App() {
  const [activeSection, setActiveSection] = useState("Map");
  const [activeSubItem, setActiveSubItem] = useState("All");

  function handleSelectSection(section: string) {
    setActiveSection(section);
    setActiveSubItem(SUBMENU_ITEMS[section][0]);
  }

  return (
    <div className={styles.shell}>
      <TopBar sections={TOP_SECTIONS} activeSection={activeSection} onSelectSection={handleSelectSection} />
      <div className={styles.body}>
        <LeftSubMenu
          heading={activeSection}
          items={SUBMENU_ITEMS[activeSection]}
          activeItem={activeSubItem}
          onSelectItem={setActiveSubItem}
        />
        <GraphCanvas />
      </div>
      <ErrorBanner />
    </div>
  );
}

export default App;
