
import { cn } from "@/lib/utils";

interface PayrollEventBadgeProps {
    type: 'S' | 'N';
}

export function PayrollEventBadge({ type }: PayrollEventBadgeProps) {
    const isYes = type === 'S';
    return (
        <span className={cn(
            "inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white rounded",
            isYes ? "bg-green-500" : "bg-red-500"
        )}>
            {type}
        </span>
    );
}
