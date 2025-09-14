import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw } from "lucide-react";

interface Trade {
  id: string;
  timestamp: string;
  route: string;
  amountInUsd: number;
  actualProfitUsd: number;
  gasUsedUsd: number;
  aiScore: number;
  status: string;
  errorMessage?: string;
}

export function TradesTable() {
  const [filter, setFilter] = useState("all");
  
  const { data: trades, isLoading, refetch } = useQuery({
    queryKey: ["/api/trades", { filter: filter !== "all" ? filter : undefined, limit: 50 }],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const formatCurrency = (value: number) => {
    const sign = value >= 0 ? "+" : "";
    return `${sign}$${value.toFixed(2)}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return <Badge className="bg-green-500/20 text-green-400">Success</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Card data-testid="card-trades-table">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Recent Trades</CardTitle>
          <div className="flex space-x-2">
            <Select value={filter} onValueChange={setFilter} data-testid="select-trades-filter">
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter trades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Trades</SelectItem>
                <SelectItem value="profitable">Profitable Only</SelectItem>
                <SelectItem value="losses">Losses Only</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
              data-testid="button-refresh-trades"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="table-trades">
              <thead className="bg-muted/20">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Route
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Profit
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Gas
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    AI Score
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {trades?.map((trade: Trade) => (
                  <tr
                    key={trade.id}
                    className="hover:bg-accent/10"
                    data-testid={`row-trade-${trade.id}`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm" data-testid={`text-time-${trade.id}`}>
                      {formatTime(trade.timestamp)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm" data-testid={`text-route-${trade.id}`}>
                      {trade.route}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm" data-testid={`text-amount-${trade.id}`}>
                      ${trade.amountInUsd.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm" data-testid={`text-profit-${trade.id}`}>
                      <span
                        className={
                          trade.actualProfitUsd >= 0 ? "text-green-500" : "text-red-500"
                        }
                      >
                        {formatCurrency(trade.actualProfitUsd)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm" data-testid={`text-gas-${trade.id}`}>
                      ${trade.gasUsedUsd.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm" data-testid={`text-ai-score-${trade.id}`}>
                      {trade.aiScore.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap" data-testid={`status-${trade.id}`}>
                      {getStatusBadge(trade.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {trades && trades.length === 0 && (
              <div className="text-center py-8 text-muted-foreground" data-testid="text-no-trades">
                No trades found
              </div>
            )}
          </div>
        )}

        <div className="px-6 py-3 border-t border-border bg-muted/10 mt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground" data-testid="text-trades-count">
              Showing {trades?.length || 0} trades
            </p>
            <div className="flex space-x-1">
              <Button variant="outline" size="sm" disabled data-testid="button-prev-trades">
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled data-testid="button-next-trades">
                Next
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
