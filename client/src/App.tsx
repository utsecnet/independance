import { useEffect, useState } from "react";
import { TopBar } from "./components/layout/TopBar/TopBar";
import { GraphCanvas } from "./components/layout/RightPane/GraphCanvas";
import { SettingsBlade } from "./components/layout/Settings/SettingsBlade";
import { LeftRail } from "./components/layout/LeftMenu/LeftRail";
import { ItemsBlade } from "./components/layout/LeftMenu/ItemsBlade";
import { ErrorBanner } from "./components/layout/ErrorBanner/ErrorBanner";
import { useConfigStore } from "./state/configStore";
import { useGraphStore } from "./state/store";
import styles from "./App.module.css";

function App() {
  const [railOpen, setRailOpen] = useState(false);
  // A node type id, "settings", or null — drives which of ItemsBlade /
  // SettingsBlade (if either) is currently slid out over the canvas.
  const [activeGroup, setActiveGroup] = useState<string | null>(null);

  useEffect(() => {
    // Config has to load (and placementMode specifically has to be applied)
    // before the graph does: loadGraph's own initial arrangeGraph call
    // checks placementMode to decide whether it's safe to re-lay-out the
    // graph, and defaulting to "auto" while the real saved mode was
    // "manual" would auto-arrange — and persist! — a graph the user had
    // deliberately left exactly as manually placed.
    async function bootstrap() {
      await useConfigStore.getState().loadConfig();
      const loadedMode = useConfigStore.getState().placementMode;
      if (loadedMode) useGraphStore.getState().applyLoadedPlacementMode(loadedMode);
      await useGraphStore.getState().loadGraph();
    }
    bootstrap();
  }, []);

  return (
    <div className={styles.shell}>
      <TopBar />
      <div className={styles.body}>
        <LeftRail
          open={railOpen}
          onToggle={() => setRailOpen((v) => !v)}
          activeGroup={activeGroup}
          onSelectGroup={(group) => setActiveGroup((prev) => (prev === group ? null : group))}
        />
        <div className={styles.mapArea}>
          <GraphCanvas />
          <ItemsBlade
            typeId={activeGroup && activeGroup !== "settings" ? activeGroup : null}
            onClose={() => setActiveGroup(null)}
          />
          <SettingsBlade open={activeGroup === "settings"} onClose={() => setActiveGroup(null)} />
        </div>
      </div>
      <ErrorBanner />
    </div>
  );
}

export default App;
