import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Power, Settings, AlertTriangle } from "lucide-react";
import { MetricsCards } from "@/components/dashboard/metrics-cards";
import { BotControls } from "@/components/dashboard/bot-controls";
import { TradesTable } from "@/components/dashboard/trades-table";
import { DexRoutes } from "@/components/dashboard/dex-routes";
import { AIStatus } from "@/components/dashboard/ai-status";
import { SystemHealth } from "@/components/dashboard/system-health";
import { useWebSocket } from "@/hooks/use-websocket";
import { useToast } from "@/hooks/use-toast";

export default function Dashboard() {
  const { toast } = useToast();
  const [killSwitchActive, setKillSwitchActive] = useState(false);

  // Fetch dashboard data
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/dashboard/stats"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: systemStatus } = useQuery({
    queryKey: ["/api/system/status"],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const { data: aiStatus } = useQuery({
    queryKey: ["/api/ai/status"],
    refetchInterval: 60000, // Refresh every minute
  });

  // WebSocket connection for real-time updates
  const { lastMessage, connectionStatus } = useWebSocket("/ws");

  // Handle WebSocket messages
  if (lastMessage) {
    try {
      const message = JSON.parse(lastMessage.data);
      if (message.type === "kill_switch_activated") {
        setKillSwitchActive(true);
        toast({
          title: "Kill Switch Activated",
          description: message.data.reason,
          variant: "destructive",
        });
      } else if (message.type === "kill_switch_reset") {
        setKillSwitchActive(false);
        toast({
          title: "Kill Switch Reset",
          description: "Bot is ready to resume trading",
        });
      }
    } catch (error) {
      console.error("Error parsing WebSocket message:", error);
    }
  }

  const handleKillSwitch = async () => {
    try {
      const response = await fetch("/api/bot/kill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Manual emergency stop" }),
      });

      if (response.ok) {
        setKillSwitchActive(true);
        toast({
          title: "Kill Switch Activated",
          description: "All trading activity has been stopped",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to activate kill switch",
        variant: "destructive",
      });
    }
  };

  const handleResetKillSwitch = async () => {
    try {
      const response = await fetch("/api/bot/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (response.ok) {
        setKillSwitchActive(false);
        toast({
          title: "Kill Switch Reset",
          description: "Bot is ready to resume trading",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to reset kill switch",
        variant: "destructive",
      });
    }
  };

  if (statsLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-card" data-testid="header">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-primary" data-testid="title">
                DeFi Arbitrage Bot
              </h1>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full" data-testid="status-indicator" />
                <span className="text-sm font-medium" data-testid="bot-status">
                  {systemStatus?.isRunning ? "Active" : "Inactive"}
                </span>
                <span className="text-xs text-muted-foreground">|</span>
                <Badge variant="secondary" data-testid="bot-mode">
                  {systemStatus?.mode || "Paper Mode"}
                </Badge>
                <span className="text-xs text-muted-foreground">|</span>
                <Badge variant="outline" data-testid="bot-chain">
                  {systemStatus?.chain || "Polygon"}
                </Badge>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {killSwitchActive && (
                <Button
                  onClick={handleResetKillSwitch}
                  variant="outline"
                  size="sm"
                  data-testid="button-reset-kill-switch"
                >
                  <Power className="h-4 w-4 mr-2" />
                  Reset Kill Switch
                </Button>
              )}
              <Button
                onClick={handleKillSwitch}
                variant="destructive"
                size="sm"
                disabled={killSwitchActive}
                data-testid="button-kill-switch"
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                {killSwitchActive ? "KILLED" : "🛑 KILL SWITCH"}
              </Button>
              <Button variant="outline" size="sm" data-testid="button-settings">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-80px)]">
        {/* Sidebar */}
        <aside className="w-64 bg-card border-r border-border" data-testid="sidebar">
          <nav className="p-4 space-y-2">
            <a
              href="#dashboard"
              className="flex items-center px-3 py-2 bg-accent text-accent-foreground rounded-md font-medium"
              data-testid="nav-dashboard"
            >
              📊 Dashboard
            </a>
            <a
              href="#trades"
              className="flex items-center px-3 py-2 text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-md"
              data-testid="nav-trades"
            >
              📝 Trade History
            </a>
            <a
              href="#backtest"
              className="flex items-center px-3 py-2 text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-md"
              data-testid="nav-backtest"
            >
              🧪 Backtesting
            </a>
            <a
              href="#ai"
              className="flex items-center px-3 py-2 text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-md"
              data-testid="nav-ai"
            >
              🤖 AI Model
            </a>
            <a
              href="#risk"
              className="flex items-center px-3 py-2 text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-md"
              data-testid="nav-risk"
            >
              ⚠️ Risk Controls
            </a>
            <a
              href="#logs"
              className="flex items-center px-3 py-2 text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-md"
              data-testid="nav-logs"
            >
              📋 Logs
            </a>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto" data-testid="main-content">
          <div className="p-6 space-y-6">
            {/* Connection Status Alert */}
            {connectionStatus !== "Connected" && (
              <Alert data-testid="alert-connection-status">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  WebSocket connection: {connectionStatus}. Real-time updates may be delayed.
                </AlertDescription>
              </Alert>
            )}

            {/* Kill Switch Alert */}
            {killSwitchActive && (
              <Alert variant="destructive" data-testid="alert-kill-switch">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Kill Switch Active:</strong> All trading activity has been stopped. 
                  Click "Reset Kill Switch" to resume operations.
                </AlertDescription>
              </Alert>
            )}

            {/* Performance Metrics */}
            <MetricsCards stats={stats} />

            {/* Bot Controls */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <BotControls systemStatus={systemStatus} />
              
              {/* DEX Routes Configuration */}
              <DexRoutes />
            </div>

            {/* Recent Trades */}
            <TradesTable />

            {/* AI Model & System Health */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <AIStatus aiStatus={aiStatus} />
              <SystemHealth systemStatus={systemStatus} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
