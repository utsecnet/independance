import { useEffect } from "react";
import { useVersionHistoryStore } from "../../../state/versionHistoryStore";
import { VersionHistoryBlade } from "./VersionHistoryBlade";
import { VersionDetailBlade } from "./VersionDetailBlade";

// Mounted once in App, alongside ItemsBlade/SettingsBlade — see
// versionHistoryStore for why this lives at the App level rather than
// nested inside whatever triggers it (LeftRail's version link).
export function VersionHistoryOverlay() {
  const historyOpen = useVersionHistoryStore((s) => s.historyOpen);
  const selectedVersion = useVersionHistoryStore((s) => s.selectedVersion);
  const closeHistory = useVersionHistoryStore((s) => s.closeHistory);
  const closeDetail = useVersionHistoryStore((s) => s.closeDetail);
  const selectVersion = useVersionHistoryStore((s) => s.selectVersion);

  useEffect(() => {
    if (!historyOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      // Backs out one level at a time: detail first, then history —
      // matching the order the blades were drilled into.
      if (selectedVersion) closeDetail();
      else closeHistory();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [historyOpen, selectedVersion, closeDetail, closeHistory]);

  return (
    <>
      <VersionHistoryBlade open={historyOpen} onClose={closeHistory} onSelectVersion={selectVersion} />
      <VersionDetailBlade version={historyOpen ? selectedVersion : null} onClose={closeDetail} />
    </>
  );
}
