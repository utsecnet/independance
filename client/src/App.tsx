import { useEffect, useState } from "react";
import { TopBar } from "./components/layout/TopBar/TopBar";
import { GraphCanvas } from "./components/layout/RightPane/GraphCanvas";
import { SettingsBlade } from "./components/layout/Settings/SettingsBlade";
import { LeftRail } from "./components/layout/LeftMenu/LeftRail";
import { ItemsBlade } from "./components/layout/LeftMenu/ItemsBlade";
import { VersionHistoryOverlay } from "./components/layout/VersionHistory/VersionHistoryOverlay";
import { ErrorBanner } from "./components/layout/ErrorBanner/ErrorBanner";
import { useConfigStore } from "./state/configStore";
import { useGraphStore } from "./state/store";
import { useVersionHistoryStore } from "./state/versionHistoryStore";
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
          onSelectGroup={(group) => {
            // Same left:0 slot as version history (see onOpenVersionHistory
            // below) — close that first so the two can't both be open.
            useVersionHistoryStore.getState().closeHistory();
            setActiveGroup((prev) => (prev === group ? null : group));
          }}
          onOpenVersionHistory={() => {
            // Version history slides out at the same left:0 slot
            // ItemsBlade/SettingsBlade use — closing whichever of those is
            // open first keeps the two from ever occupying that slot at once.
            setActiveGroup(null);
            useVersionHistoryStore.getState().openHistory();
          }}
        />
        <div className={styles.mapArea}>
          <GraphCanvas />
          <ItemsBlade
            typeId={activeGroup && activeGroup !== "settings" ? activeGroup : null}
            onClose={() => setActiveGroup(null)}
          />
          <SettingsBlade open={activeGroup === "settings"} onClose={() => setActiveGroup(null)} />
          <VersionHistoryOverlay />
        </div>
      </div>
      <ErrorBanner />
    </div>
  );
}

export default App;
