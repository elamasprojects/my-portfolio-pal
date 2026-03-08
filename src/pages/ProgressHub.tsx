import { useNavigate, useLocation } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useLanguage } from "@/i18n";
import Achievements from "./Achievements";
import Discipline from "./Discipline";

const tabMap: Record<string, string> = {
  "/progress": "titles",
  "/progress/discipline": "discipline",
};

const routeMap: Record<string, string> = {
  titles: "/progress",
  discipline: "/progress/discipline",
};

const ProgressHub = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const activeTab = tabMap[location.pathname] || "titles";

  const handleTabChange = (value: string) => {
    navigate(routeMap[value], { replace: true });
  };

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="titles">{t("nav.titles")}</TabsTrigger>
          <TabsTrigger value="discipline">{t("nav.openingBook")}</TabsTrigger>
        </TabsList>
        <TabsContent value="titles"><Achievements /></TabsContent>
        <TabsContent value="discipline"><Discipline /></TabsContent>
      </Tabs>
    </div>
  );
};

export default ProgressHub;
