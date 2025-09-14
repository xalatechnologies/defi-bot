import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Brain, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AIStatusProps {
  aiStatus?: {
    accuracy: number;
    lastTrained: string;
    sampleCount: number;
    isTraining?: boolean;
  };
}

export function AIStatus({ aiStatus }: AIStatusProps) {
  const { toast } = useToast();

  const handleRetrain = async () => {
    try {
      const response = await fetch("/api/ai/retrain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (response.ok) {
        toast({
          title: "AI Training Started",
          description: "The AI model is being retrained with latest data",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to start AI model retraining",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <Card data-testid="card-ai-status">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          AI Model Performance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-sm">Model Accuracy</span>
          <span className="font-medium" data-testid="text-ai-accuracy">
            {aiStatus ? `${aiStatus.accuracy.toFixed(1)}%` : "Loading..."}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-sm">Last Training</span>
          <span className="text-sm text-muted-foreground" data-testid="text-ai-last-trained">
            {aiStatus ? formatDate(aiStatus.lastTrained) : "Loading..."}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-sm">Training Samples</span>
          <span className="font-medium" data-testid="text-ai-sample-count">
            {aiStatus ? aiStatus.sampleCount.toLocaleString() : "Loading..."}
          </span>
        </div>

        <Button
          onClick={handleRetrain}
          variant="secondary"
          className="w-full"
          disabled={aiStatus?.isTraining}
          data-testid="button-retrain-ai"
        >
          {aiStatus?.isTraining ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Training...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retrain Model
            </>
          )}
        </Button>

        {/* AI Performance Indicators */}
        <div className="space-y-2 pt-2 border-t border-border">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Feature Importance</span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span>Spread BPS</span>
              <span>30%</span>
            </div>
            <div className="flex justify-between text-xs">
              <span>Liquidity Depth</span>
              <span>25%</span>
            </div>
            <div className="flex justify-between text-xs">
              <span>Volatility</span>
              <span>20%</span>
            </div>
            <div className="flex justify-between text-xs">
              <span>Other Features</span>
              <span>25%</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
