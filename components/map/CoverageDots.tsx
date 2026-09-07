import { cn } from "@/lib/utils";
import { COVERAGE_DOTS, filledCoverageDots } from "@/lib/map/coverage";

/**
 * The compact coverage indicator beside a domain heading.
 *
 * Four dots, filled in proportion to how well the manager holds the domain.
 * Deliberately not coloured by severity: a thin domain is not an error, it is
 * a fact about where the manager is early. Filled dots use the brand teal,
 * empty ones the muted surface.
 */
export function CoverageDots({
  score,
  className,
}: {
  score: number | null;
  className?: string;
}) {
  const filled = filledCoverageDots(score);

  return (
    <span
      className={cn("inline-flex items-center gap-1", className)}
      aria-hidden="true"
    >
      {Array.from({ length: COVERAGE_DOTS }, (_, i) => (
        <span
          key={i}
          className={cn(
            "size-1.5 rounded-full",
            i < filled ? "bg-primary" : "bg-muted",
          )}
        />
      ))}
    </span>
  );
}
