import { useNavigate, useLocation } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useLanguage } from "@/i18n";
import Performance from "./Performance";
import Timeline from "./Timeline";
import ReportCard from "./ReportCard";

const tabMap: Record<string, string> = {
  "/analysis": "performance",
  "/analysis/timeline": "timeline",
  "/analysis/report": "report",
};

const routeMap: Record<string, string> = {
  performance: "/analysis",
  timeline: "/analysis/timeline",
  report: "/analysis/report",
};

const AnalysisHub = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const activeTab = tabMap[location.pathname] || "performance";

  const handleTabChange = (value: string) => {
    navigate(routeMap[value], { replace: true });
  };

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="performance">{t("nav.analysis")}</TabsTrigger>
          <TabsTrigger value="timeline">{t("nav.gameClock")}</TabsTrigger>
          <TabsTrigger value="report">{t("nav.scoreSheet")}</TabsTrigger>
        </TabsList>
        <TabsContent value="performance"><Performance /></TabsContent>
        <TabsContent value="timeline"><Timeline /></TabsContent>
        <TabsContent value="report"><ReportCard /></TabsContent>
      </Tabs>
    </div>
  );
};

export default AnalysisHub;
