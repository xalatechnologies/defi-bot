import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, BarChart3, Target, Fuel } from "lucide-react";

interface MetricsCardsProps {
  stats?: {
    dailyPnl: number;
    weeklyPnl: number;
    winRate: number;
    avgGasCost: number;
    tradesCount: number;
  };
}

export function MetricsCards({ stats }: MetricsCardsProps) {
  if (!stats) return null;

  const formatCurrency = (value: number) => {
    const sign = value >= 0 ? "+" : "";
    return `${sign}$${value.toFixed(2)}`;
  };

  const formatPercent = (value: number) => `${value.toFixed(1)}%`;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Daily PnL Card */}
      <Card data-testid="card-daily-pnl">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Daily PnL</p>
              <p
                className={`text-2xl font-bold ${
                  stats.dailyPnl >= 0 ? "text-green-500" : "text-red-500"
                }`}
                data-testid="text-daily-pnl"
              >
                {formatCurrency(stats.dailyPnl)}
              </p>
            </div>
            <div className="text-green-500">
              <TrendingUp className="h-6 w-6" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2" data-testid="text-daily-change">
            {stats.dailyPnl >= 0 ? "+2.8% from yesterday" : "-1.2% from yesterday"}
          </p>
        </CardContent>
      </Card>

      {/* Weekly PnL Card */}
      <Card data-testid="card-weekly-pnl">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Weekly PnL</p>
              <p
                className={`text-2xl font-bold ${
                  stats.weeklyPnl >= 0 ? "text-green-500" : "text-red-500"
                }`}
                data-testid="text-weekly-pnl"
              >
                {formatCurrency(stats.weeklyPnl)}
              </p>
            </div>
            <div className="text-green-500">
              <BarChart3 className="h-6 w-6" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2" data-testid="text-weekly-trades">
            {stats.tradesCount} trades executed
          </p>
        </CardContent>
      </Card>

      {/* Win Rate Card */}
      <Card data-testid="card-win-rate">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Win Rate</p>
              <p className="text-2xl font-bold" data-testid="text-win-rate">
                {formatPercent(stats.winRate)}
              </p>
            </div>
            <div className="text-blue-500">
              <Target className="h-6 w-6" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2" data-testid="text-win-context">
            {Math.floor((stats.winRate / 100) * stats.tradesCount)} wins / {stats.tradesCount} trades
          </p>
        </CardContent>
      </Card>

      {/* Gas Usage Card */}
      <Card data-testid="card-gas-usage">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Avg Gas Cost</p>
              <p className="text-2xl font-bold" data-testid="text-avg-gas">
                ${stats.avgGasCost.toFixed(2)}
              </p>
            </div>
            <div className="text-yellow-500">
              <Fuel className="h-6 w-6" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2" data-testid="text-gas-efficiency">
            15% below target
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
