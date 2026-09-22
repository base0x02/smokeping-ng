import { Routes, Route } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api/client.js";
import { Sidebar } from "./components/Sidebar.js";
import { Dashboard } from "./pages/Dashboard.js";
import { GroupPage } from "./pages/GroupPage.js";
import { TargetPage } from "./pages/TargetPage.js";
import { AdminPage } from "./pages/AdminPage.js";

export default function App() {
  const treeQuery = useQuery({ queryKey: ["group-tree"], queryFn: api.getGroupTree });

  return (
    <div className="flex h-screen bg-surface-page">
      <Sidebar tree={treeQuery.data} isLoading={treeQuery.isLoading} />
      <main className="flex flex-1 flex-col overflow-hidden">
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
