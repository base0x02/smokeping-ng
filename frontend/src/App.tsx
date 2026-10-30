import { useCallback, useState } from "react";
import { Routes, Route } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api/client.js";
import { Header } from "./components/Header.js";
import { Sidebar } from "./components/Sidebar.js";
import { Dashboard } from "./pages/Dashboard.js";
import { GroupPage } from "./pages/GroupPage.js";
import { TargetPage } from "./pages/TargetPage.js";
import { AdminPage } from "./pages/AdminPage.js";
import { AlertsPage } from "./pages/AlertsPage.js";
import { GraphLegend } from "./components/GraphLegend.js";
import { useCurrentPageChrome } from "./hooks/usePageChrome.js";
import { useLegendPosition, useLegendVisible } from "./hooks/useLegendPrefs.js";

export default function App() {
  const treeQuery = useQuery({ queryKey: ["group-tree"], queryFn: api.getGroupTree });
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const { hasGraphs } = useCurrentPageChrome();
  const [legendVisible] = useLegendVisible();
  const [legendPosition] = useLegendPosition();
  // Pinned outside the scrolling page, so it stays on screen while scrolling through graphs.
  const legendBar = (edge: "top" | "bottom") =>
    hasGraphs && legendVisible && legendPosition === edge ? (
      <div className={`shrink-0 bg-surface px-6 py-2 ${edge === "top" ? "border-b" : "border-t"} border-line-hairline`}>
        <GraphLegend />
      </div>
    ) : null;

  return (
    <div className="flex h-screen flex-col bg-surface-page">
      <Header menuOpen={menuOpen} onToggleMenu={() => setMenuOpen((o) => !o)} />
      <Sidebar tree={treeQuery.data} isLoading={treeQuery.isLoading} open={menuOpen} onClose={closeMenu} />
      {legendBar("top")}
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/group/:groupId" element={<GroupPage />} />
          <Route path="/target/:targetId" element={<TargetPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/alerts" element={<AlertsPage />} />
        </Routes>
      </main>
      {legendBar("bottom")}
    </div>
  );
}
