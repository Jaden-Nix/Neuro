import { useState, useEffect } from "react";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Pause, SkipBack, SkipForward } from "lucide-react";

interface TimeWarpSliderProps {
  events: Array<{ timestamp: number; description: string }>;
  onTimeChange?: (timestamp: number) => void;
}

export function TimeWarpSlider({ events, onTimeChange }: TimeWarpSliderProps) {
  const [currentIndex, setCurrentIndex] = useState(events.length > 0 ? events.length - 1 : 0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Auto-advance when playing
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => {
        if (prev >= events.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        const newIndex = prev + 1;
        if (events[newIndex] && onTimeChange) {
          onTimeChange(events[newIndex].timestamp);
        }
        return newIndex;
      });
    }, 800);
    return () => clearInterval(interval);
  }, [isPlaying, events, onTimeChange]);

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const handleSliderChange = (value: number[]) => {
    const index = value[0];
    setCurrentIndex(index);
    if (events[index] && onTimeChange) {
      onTimeChange(events[index].timestamp);
    }
  };

  const handleSkipBack = () => {
    const newIndex = Math.max(0, currentIndex - 1);
    setCurrentIndex(newIndex);
    if (events[newIndex] && onTimeChange) {
      onTimeChange(events[newIndex].timestamp);
    }
  };

  const handleSkipForward = () => {
    const newIndex = Math.min(events.length - 1, currentIndex + 1);
    setCurrentIndex(newIndex);
    if (events[newIndex] && onTimeChange) {
      onTimeChange(events[newIndex].timestamp);
    }
  };

  const currentEvent = events[currentIndex];

  if (events.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            <p className="text-sm">No timeline events yet. Run a simulation to begin.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="timewarp-slider">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-display font-semibold">Timeline Navigator</h3>
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="outline"
              onClick={handleSkipBack}
              disabled={currentIndex === 0}
              data-testid="button-skip-back"
            >
              <SkipBack className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              variant={isPlaying ? "default" : "outline"}
              onClick={() => setIsPlaying(!isPlaying)}
              data-testid="button-play-pause"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </Button>
            <Button
              size="icon"
              variant="outline"
              onClick={handleSkipForward}
              disabled={currentIndex === events.length - 1}
              data-testid="button-skip-forward"
            >
              <SkipForward className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <Slider
            value={[currentIndex]}
            onValueChange={handleSliderChange}
            max={events.length - 1}
            step={1}
            className="w-full"
            data-testid="slider-timeline"
          />

          <div className="flex justify-between text-xs text-muted-foreground font-mono">
            <span>{formatTimestamp(events[0].timestamp)}</span>
            <span>
              Event {currentIndex + 1} / {events.length}
            </span>
            <span>{formatTimestamp(events[events.length - 1].timestamp)}</span>
          </div>
        </div>

        {currentEvent && (
          <div className="p-3 rounded-md bg-muted/50 border border-border space-y-2">
            <div className="flex justify-between items-start">
              <span className="text-xs font-mono font-semibold text-foreground">
                Event {currentIndex + 1} / {events.length}
              </span>
              <span className="text-xs font-mono text-muted-foreground">
                {formatTimestamp(currentEvent.timestamp)}
              </span>
            </div>
            <p className="text-sm text-foreground leading-relaxed break-words max-w-sm" data-testid="text-current-event">
              {currentEvent.description}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
