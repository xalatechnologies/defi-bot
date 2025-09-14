import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface BotControlsProps {
  systemStatus?: {
    mode: string;
    chain: string;
  };
}

export function BotControls({ systemStatus }: BotControlsProps) {
  const { toast } = useToast();
  const [isLiveMode, setIsLiveMode] = useState(systemStatus?.mode === "live");
  const [aiEnabled, setAiEnabled] = useState(true);
  const [params, setParams] = useState({
    minProfitUsd: "0.50",
    maxDailyLoss: "50.00",
    slippageBps: "25",
    maxNotional: "200.00",
  });

  const handleModeToggle = async (checked: boolean) => {
    try {
      const mode = checked ? "live" : "paper";
      const response = await fetch("/api/bot/mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });

      if (response.ok) {
        setIsLiveMode(checked);
        toast({
          title: "Mode Changed",
          description: `Bot switched to ${mode} mode`,
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to change trading mode",
        variant: "destructive",
      });
    }
  };

  const handleParamsUpdate = async () => {
    try {
      const response = await fetch("/api/bot/params", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          minProfitUsd: parseFloat(params.minProfitUsd),
          maxDailyLossUsd: parseFloat(params.maxDailyLoss),
          slippageBps: parseInt(params.slippageBps),
          maxNotionalUsd: parseFloat(params.maxNotional),
        }),
      });

      if (response.ok) {
        toast({
          title: "Parameters Updated",
          description: "Risk parameters have been updated successfully",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update parameters",
        variant: "destructive",
      });
    }
  };

  return (
    <Card data-testid="card-bot-controls">
      <CardHeader>
        <CardTitle>Bot Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Trading Mode Toggle */}
        <div className="flex items-center justify-between">
          <Label className="flex flex-col">
            <span className="text-sm font-medium">Trading Mode</span>
            <span className="text-xs text-muted-foreground">
              Switch between paper and live trading
            </span>
          </Label>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground">Paper</span>
            <Switch
              checked={isLiveMode}
              onCheckedChange={handleModeToggle}
              data-testid="switch-trading-mode"
            />
            <span className="text-sm">Live</span>
          </div>
        </div>

        {/* Chain Selection */}
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Chain</Label>
          <Select defaultValue="polygon" data-testid="select-chain">
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="polygon">Polygon</SelectItem>
              <SelectItem value="arbitrum">Arbitrum</SelectItem>
              <SelectItem value="ethereum">Ethereum</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* AI Model Toggle */}
        <div className="flex items-center justify-between">
          <Label className="flex flex-col">
            <span className="text-sm font-medium">AI Signal Filtering</span>
            <span className="text-xs text-muted-foreground">
              Use ML model for trade scoring
            </span>
          </Label>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground">Off</span>
            <Switch
              checked={aiEnabled}
              onCheckedChange={setAiEnabled}
              data-testid="switch-ai-enabled"
            />
            <span className="text-sm">On</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function RiskParameters() {
  const { toast } = useToast();
  const [params, setParams] = useState({
    minProfitUsd: "0.50",
    maxDailyLoss: "50.00",
    slippageBps: "25",
    maxNotional: "200.00",
  });

  const handleParamsUpdate = async () => {
    try {
      const response = await fetch("/api/bot/params", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          minProfitUsd: parseFloat(params.minProfitUsd),
          maxDailyLossUsd: parseFloat(params.maxDailyLoss),
          slippageBps: parseInt(params.slippageBps),
          maxNotionalUsd: parseFloat(params.maxNotional),
        }),
      });

      if (response.ok) {
        toast({
          title: "Parameters Updated",
          description: "Risk parameters have been updated successfully",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update parameters",
        variant: "destructive",
      });
    }
  };

  return (
    <Card data-testid="card-risk-parameters">
      <CardHeader>
        <CardTitle>Risk Parameters</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Min Profit USD</Label>
          <Input
            type="number"
            step="0.01"
            value={params.minProfitUsd}
            onChange={(e) => setParams({ ...params, minProfitUsd: e.target.value })}
            className="w-20"
            data-testid="input-min-profit"
          />
        </div>

        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Max Daily Loss USD</Label>
          <Input
            type="number"
            step="1.00"
            value={params.maxDailyLoss}
            onChange={(e) => setParams({ ...params, maxDailyLoss: e.target.value })}
            className="w-20"
            data-testid="input-max-daily-loss"
          />
        </div>

        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Slippage BPS</Label>
          <Input
            type="number"
            step="1"
            value={params.slippageBps}
            onChange={(e) => setParams({ ...params, slippageBps: e.target.value })}
            className="w-20"
            data-testid="input-slippage-bps"
          />
        </div>

        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Max Position USD</Label>
          <Input
            type="number"
            step="10.00"
            value={params.maxNotional}
            onChange={(e) => setParams({ ...params, maxNotional: e.target.value })}
            className="w-20"
            data-testid="input-max-notional"
          />
        </div>

        <Button
          onClick={handleParamsUpdate}
          className="w-full mt-4"
          data-testid="button-update-params"
        >
          Update Parameters
        </Button>
      </CardContent>
    </Card>
  );
}
