import { useState } from "react";
import { TopBar } from "./components/layout/TopBar/TopBar";
import { LeftSubMenu } from "./components/layout/LeftSubMenu/LeftSubMenu";
import { LeftPane } from "./components/layout/LeftPane/LeftPane";
import { GraphCanvas } from "./components/layout/RightPane/GraphCanvas";
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
      <TopBar
        sections={TOP_SECTIONS}
        activeSection={activeSection}
        onSelectSection={handleSelectSection}
        breadcrumb={[activeSection, activeSubItem]}
      />
      <div className={styles.body}>
        <LeftSubMenu
          heading={activeSection}
          items={SUBMENU_ITEMS[activeSection]}
          activeItem={activeSubItem}
          onSelectItem={setActiveSubItem}
        />
        <LeftPane />
        <GraphCanvas />
      </div>
    </div>
  );
}

export default App;
