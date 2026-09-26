import { useCallback } from "react";
import { CaseProvider, useCase } from "./context/CaseContext.jsx";
import AppShell from "./components/AppShell.jsx";
import LiveMode from "./modes/LiveMode.jsx";
import DemoMode from "./modes/DemoMode.jsx";

// Detail investigation pages
import InvestigationCopilotPage from "./pages/InvestigationCopilotPage.jsx";
import NewCaseUpload from "./pages/NewCaseUpload.jsx";
import CaseAnalysisPage from "./pages/CaseAnalysisPage.jsx";
import SpillDetectionPage from "./pages/SpillDetectionPage.jsx";
import SpillGeometryPage from "./pages/SpillGeometryPage.jsx";
import AISInvestigationPage from "./pages/AISInvestigationPage.jsx";
import OriginBacktrackingPage from "./pages/OriginBacktrackingPage.jsx";
import FuturePredictionPage from "./pages/FuturePredictionPage.jsx";
import ValidationAccuracyPage from "./pages/ValidationAccuracyPage.jsx";
import CaseHistoryPage from "./pages/CaseHistoryPage.jsx";
import SystemHealth from "./pages/SystemHealth.jsx";

/**
 * PageRouter — renders the appropriate page based on `currentPage` in CaseContext.
 * "map" renders the main DemoMode map; all other values render their respective
 * investigation pages inside a scrollable container.
 */
function PageRouter() {
  const { appMode, currentPage } = useCase();

  if (appMode === "LIVE") {
    return <LiveMode />;
  }

  // Demo Mode — "map" is the main interactive map; other pages are detail views
  if (currentPage === "map") {
    return <DemoMode />;
  }

  const pageMap = {
    copilot: <InvestigationCopilotPage />,
    upload: <NewCaseUpload />,
    analysis: <CaseAnalysisPage />,
    detection: <SpillDetectionPage />,
    geometry: <SpillGeometryPage />,
    ais: <AISInvestigationPage />,
    backtracking: <OriginBacktrackingPage />,
    prediction: <FuturePredictionPage />,
    validation: <ValidationAccuracyPage />,
    history: <CaseHistoryPage />,
    systemhealth: <SystemHealth />,
  };

  const Page = pageMap[currentPage];
  if (!Page) return <DemoMode />;

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left vertical nav for investigation pages */}
      <InvestigationSidebar />
      {/* Scrollable page content */}
      <div className="flex-1 overflow-y-auto bg-[#040c1e] px-6 py-6 text-slate-200">
        {Page}
      </div>
    </div>
  );
}

/**
 * InvestigationSidebar — narrow left sidebar showing all investigation steps
 * with the current page highlighted.
 */
function InvestigationSidebar() {
  const { currentPage, navigateTo, currentCase } = useCase();

  const hasAnalysis = Boolean(currentCase?.analysis);
  const hasValidation = Boolean(currentCase?.validation);

  const nav = [
    { id: "map", icon: "🗺", label: "Live Map", section: null },
    { id: "copilot", icon: "🤖", label: "Investigation Copilot", section: "INVESTIGATION" },
    { id: "upload", icon: "📁", label: "Data Upload", section: null },
    { id: "analysis", icon: "⚙️", label: "Run Analysis", section: null },
    { id: "detection", icon: "📡", label: "Spill Detection", section: null },
    { id: "geometry", icon: "📐", label: "Spill Geometry", section: null },
    { id: "ais", icon: "🚢", label: "AIS Attribution", section: null },
    { id: "backtracking", icon: "⏪", label: "Origin Backtrack", section: null },
    { id: "prediction", icon: "⏩", label: "Future Prediction", section: null },
    { id: "validation", icon: "✅", label: "Validation", section: null },
    { id: "history", icon: "🗃", label: "Case History", section: "SYSTEM" },
    { id: "systemhealth", icon: "💊", label: "System Health", section: null },
  ];

  // Remove DashboardPage import reference — dashboard nav entry removed

  let lastSection = null;

  return (
    <div className="w-52 shrink-0 bg-[#060d1e] border-r border-[#142340] flex flex-col overflow-y-auto z-10 shadow-2xl">
      <div className="p-3 border-b border-[#142340]">
        <div className="text-[10px] font-bold uppercase tracking-widest text-purple-400">
          DEMO MODE
        </div>
        <div className="text-[11px] text-slate-400 mt-0.5 truncate">
          {currentCase?.name || "Investigation Workflow"}
        </div>
      </div>

      <nav className="flex-1 py-2">
        {nav.map((item) => {
          const showSection = item.section && item.section !== lastSection;
          if (item.section) lastSection = item.section;

          const isActive = currentPage === item.id;
          return (
            <div key={item.id}>
              {showSection && (
                <div className="px-3 pt-3 pb-1 text-[9px] font-bold uppercase tracking-widest text-slate-500">
                  {item.section}
                </div>
              )}
              <button
                onClick={() => navigateTo(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-all ${
                  isActive
                    ? "bg-[#0c1f45] text-white border-r-2 border-purple-400 font-semibold"
                    : "text-slate-400 hover:text-white hover:bg-[#0a1630]"
                }`}
              >
                <span className="text-sm leading-none">{item.icon}</span>
                <span className="truncate">{item.label}</span>
                {item.id === "analysis" && !hasAnalysis && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                )}
                {item.id === "validation" && hasAnalysis && !hasValidation && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                )}
              </button>
            </div>
          );
        })}
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <CaseProvider>
      <AppShell>
        <PageRouter />
      </AppShell>
    </CaseProvider>
  );
}
