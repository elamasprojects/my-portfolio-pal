import { useNavigate, useLocation } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useLanguage } from "@/i18n";
import AddTrade from "./AddTrade";
import ImportTrades from "./ImportTrades";

const tabMap: Record<string, string> = {
  "/add": "manual",
  "/add/import": "import",
};

const routeMap: Record<string, string> = {
  manual: "/add",
  import: "/add/import",
};

const AddTradeHub = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const activeTab = tabMap[location.pathname] || "manual";

  const handleTabChange = (value: string) => {
    navigate(routeMap[value], { replace: true });
  };

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="manual">{t("addTrade.inputManual")}</TabsTrigger>
          <TabsTrigger value="import">{t("nav.importPgn")}</TabsTrigger>
        </TabsList>
        <TabsContent value="manual"><AddTrade /></TabsContent>
        <TabsContent value="import"><ImportTrades /></TabsContent>
      </Tabs>
    </div>
  );
};

export default AddTradeHub;
