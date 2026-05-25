"use client";

import { Card, CardHeader } from "@/components/ui/card";
import { QualificationBadge } from "./QualificationBadge";
import type { Job, QualifiedJob } from "@/lib/types";

interface JobCardProps {
  job: Job;
  qualification?: QualifiedJob;
}

function formatBudget(min: number | null, max: number | null): string {
  if (min === null && max === null) return "Budget not specified";
  if (min !== null && max !== null)
    return `$${min.toLocaleString()}–$${max.toLocaleString()}`;
  if (min !== null) return `From $${min.toLocaleString()}`;
  return `Up to $${max!.toLocaleString()}`;
}

export function JobCard({ job, qualification }: JobCardProps) {
  return (
    <Card className="border border-gray-200">
      <CardHeader className="pb-3 pt-4 px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-gray-900 hover:text-blue-600 text-sm leading-tight"
            >
              {job.title}
            </a>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="text-xs text-gray-500">
                {formatBudget(job.budget_min, job.budget_max)}
              </span>
              {qualification && (
                <>
                  <span className="text-gray-300">·</span>
                  <QualificationBadge
                    score={qualification.score}
                    recommendation={qualification.recommendation}
                    redFlags={qualification.red_flags}
                    greenFlags={qualification.green_flags}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}
