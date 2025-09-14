import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Wifi, Database, Shield } from "lucide-react";

interface SystemHealthProps {
  systemStatus?: {
    wsConnected: boolean;
    rpcHealthy: boolean;
    dbConnected: boolean;
    riskControlsActive: boolean;
    timestamp?: string;
  };
}

export function SystemHealth({ systemStatus }: SystemHealthProps) {
  const getStatusColor = (isHealthy: boolean) => {
    return isHealthy ? "text-green-400" : "text-red-400";
  };

  const getStatusText = (isHealthy: boolean) => {
    return isHealthy ? "Healthy" : "Error";
  };

  const formatLastUpdate = (timestamp?: string) => {
    if (!timestamp) return "Unknown";
    return new Date(timestamp).toLocaleTimeString();
  };

  const healthChecks = [
    {
      icon: Wifi,
      label: "WebSocket Connection",
      status: systemStatus?.wsConnected ?? false,
      testId: "health-websocket",
    },
    {
      icon: Activity,
      label: "Polygon RPC",
      status: systemStatus?.rpcHealthy ?? false,
      testId: "health-rpc",
    },
    {
      icon: Database,
      label: "Database",
      status: systemStatus?.dbConnected ?? false,
      testId: "health-database",
    },
    {
      icon: Shield,
      label: "Risk Controls",
      status: systemStatus?.riskControlsActive ?? false,
      testId: "health-risk-controls",
    },
  ];

  return (
    <Card data-testid="card-system-health">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          System Health
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {healthChecks.map((check, index) => {
          const IconComponent = check.icon;
          return (
            <div key={index} className="flex items-center justify-between" data-testid={check.testId}>
              <span className="flex items-center text-sm">
                <div 
                  className={`w-2 h-2 rounded-full mr-2 ${
                    check.status ? "bg-green-500" : "bg-red-500"
                  }`} 
                />
                <IconComponent className="h-4 w-4 mr-2" />
                {check.label}
              </span>
              <Badge
                variant={check.status ? "default" : "destructive"}
                className={getStatusColor(check.status)}
              >
                {getStatusText(check.status)}
              </Badge>
            </div>
          );
        })}

        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground" data-testid="text-last-update">
            Last update: {formatLastUpdate(systemStatus?.timestamp)}
          </p>
        </div>

        {/* Additional System Metrics */}
        <div className="space-y-2 pt-2 border-t border-border">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">System Metrics</span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span>Memory Usage</span>
              <span className="text-muted-foreground">68%</span>
            </div>
            <div className="flex justify-between text-xs">
              <span>CPU Usage</span>
              <span className="text-muted-foreground">23%</span>
            </div>
            <div className="flex justify-between text-xs">
              <span>Network Latency</span>
              <span className="text-muted-foreground">45ms</span>
            </div>
            <div className="flex justify-between text-xs">
              <span>Active Pairs</span>
              <span className="text-muted-foreground">12</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
