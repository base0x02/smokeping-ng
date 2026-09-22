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

export default function App() {
  const treeQuery = useQuery({ queryKey: ["group-tree"], queryFn: api.getGroupTree });
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  return (
    <div className="flex h-screen flex-col bg-surface-page">
      <Header menuOpen={menuOpen} onToggleMenu={() => setMenuOpen((o) => !o)} />
      <Sidebar tree={treeQuery.data} isLoading={treeQuery.isLoading} open={menuOpen} onClose={closeMenu} />
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/group/:groupId" element={<GroupPage />} />
          <Route path="/target/:targetId" element={<TargetPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </main>
    </div>
  );
}
