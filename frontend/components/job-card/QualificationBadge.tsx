"use client";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface QualificationBadgeProps {
  score: number;
  recommendation: "Pursue" | "Skip" | "Review";
  redFlags?: string[];
  greenFlags?: string[];
}

function getBadgeStyle(recommendation: "Pursue" | "Skip" | "Review"): string {
  if (recommendation === "Pursue") return "bg-green-100 text-green-800 border-green-200";
  if (recommendation === "Skip") return "bg-red-100 text-red-800 border-red-200";
  return "bg-amber-100 text-amber-800 border-amber-200";
}

export function QualificationBadge({
  score,
  recommendation,
  redFlags = [],
  greenFlags = [],
}: QualificationBadgeProps) {
  const badgeStyle = getBadgeStyle(recommendation);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge className={`text-xs border cursor-pointer ${badgeStyle}`} variant="outline">
            {score.toFixed(1)}/10 · {recommendation}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs p-3" side="bottom">
          <div className="space-y-2 text-xs">
            {greenFlags.length > 0 && (
              <div>
                <p className="font-semibold text-green-700 mb-1">Green flags</p>
                <ul className="list-disc list-inside space-y-0.5 text-gray-700">
                  {greenFlags.map((flag, i) => (
                    <li key={i}>{flag}</li>
                  ))}
                </ul>
              </div>
            )}
            {redFlags.length > 0 && (
              <div>
                <p className="font-semibold text-red-700 mb-1">Red flags</p>
                <ul className="list-disc list-inside space-y-0.5 text-gray-700">
                  {redFlags.map((flag, i) => (
                    <li key={i}>{flag}</li>
                  ))}
                </ul>
              </div>
            )}
            {greenFlags.length === 0 && redFlags.length === 0 && (
              <p className="text-gray-500">No flags detected</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
