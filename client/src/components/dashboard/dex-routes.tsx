import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

interface DexRoute {
  id: string;
  name: string;
  type: string;
  chain: string;
  enabled: boolean;
  comingSoon?: boolean;
}

export function DexRoutes() {
  const { toast } = useToast();
  const [routes, setRoutes] = useState<DexRoute[]>([
    {
      id: "quickswap",
      name: "QuickSwap",
      type: "UniV2",
      chain: "Polygon",
      enabled: true,
    },
    {
      id: "sushiswap",
      name: "SushiSwap",
      type: "UniV2",
      chain: "Polygon",
      enabled: true,
    },
    {
      id: "uniswap-v3",
      name: "Uniswap V3",
      type: "V3",
      chain: "Polygon",
      enabled: false,
      comingSoon: true,
    },
  ]);

  const handleToggle = async (routeId: string, enabled: boolean) => {
    const route = routes.find(r => r.id === routeId);
    
    if (route?.comingSoon) {
      toast({
        title: "Coming Soon",
        description: `${route.name} integration is coming soon`,
        variant: "default",
      });
      return;
    }

    try {
      const response = await fetch("/api/dex/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dex: routeId, enabled }),
      });

      if (response.ok) {
        setRoutes(prev => 
          prev.map(route => 
            route.id === routeId ? { ...route, enabled } : route
          )
        );
        
        toast({
          title: `${route?.name} ${enabled ? "Enabled" : "Disabled"}`,
          description: `${route?.name} route has been ${enabled ? "enabled" : "disabled"}`,
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to toggle ${route?.name} route`,
        variant: "destructive",
      });
    }
  };

  return (
    <Card data-testid="card-dex-routes">
      <CardHeader>
        <CardTitle>DEX Routes Configuration</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {routes.map((route) => (
            <div
              key={route.id}
              className={`flex items-center justify-between p-4 rounded-lg ${
                route.comingSoon 
                  ? "bg-muted/20 opacity-60" 
                  : "bg-accent/20"
              }`}
              data-testid={`dex-route-${route.id}`}
            >
              <div className="flex items-center space-x-3">
                <div 
                  className={`w-2 h-2 rounded-full ${
                    route.enabled && !route.comingSoon ? "bg-green-500" : "bg-red-500"
                  }`}
                  data-testid={`status-indicator-${route.id}`}
                />
                <div>
                  <p className="font-medium" data-testid={`text-name-${route.id}`}>
                    {route.name}
                  </p>
                  <p className="text-xs text-muted-foreground" data-testid={`text-details-${route.id}`}>
                    {route.type} • {route.chain}
                    {route.comingSoon && " • Coming Soon"}
                  </p>
                </div>
              </div>
              <Switch
                checked={route.enabled && !route.comingSoon}
                onCheckedChange={(enabled) => handleToggle(route.id, enabled)}
                disabled={route.comingSoon}
                data-testid={`switch-${route.id}`}
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
