import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import DashboardLayout from "./components/DashboardLayout";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import OrderControl from "./pages/OrderControl";
import ChatHub from "./pages/ChatHub";
import ProductAliases from "@/pages/ProductAliases";
import OrderPerformance from "@/pages/OrderPerformance";
import StockRoom from "@/pages/StockRoom";
import MappingDashboard from "@/pages/MappingDashboard";
import OrderBuckets from "@/pages/OrderBuckets";
import DailyChatSummary from "@/pages/DailyChatSummary";
import OrderHistory from "@/pages/OrderHistory";

function Router() {
  return (
    <Switch>
      <Route path="/orders">
        <DashboardLayout><OrderControl /></DashboardLayout>
      </Route>
      <Route path="/chats">
        <DashboardLayout><ChatHub /></DashboardLayout>
      </Route>
      <Route path="/aliases">
        <DashboardLayout><ProductAliases /></DashboardLayout>
      </Route>
      <Route path="/order-performance">
        <DashboardLayout><OrderPerformance /></DashboardLayout>
      </Route>
      <Route path="/stock-room">
        <DashboardLayout><StockRoom /></DashboardLayout>
      </Route>
      <Route path="/mapping-dashboard">
        <DashboardLayout><MappingDashboard /></DashboardLayout>
      </Route>
      <Route path="/order-buckets">
        <DashboardLayout><OrderBuckets /></DashboardLayout>
      </Route>
      <Route path="/daily-chat-summary">
        <DashboardLayout><DailyChatSummary /></DashboardLayout>
      </Route>
      <Route path="/order-history">
        <DashboardLayout><OrderHistory /></DashboardLayout>
      </Route>
      <Route path="/">
        <DashboardLayout><Home /></DashboardLayout>
      </Route>
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
