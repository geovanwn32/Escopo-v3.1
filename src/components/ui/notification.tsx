
"use client"

import React from "react";
import { motion } from "framer-motion";
import { Bell, CheckCircle, XCircle, AlertTriangle } from "lucide-react";

export interface NotificationCardProps {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  variant?: "default" | "destructive" | "success" | "warning";
  onOpenChange: (open: boolean) => void;
}

const ICONS = {
    default: <Bell className="h-6 w-6 text-primary" />,
    success: <CheckCircle className="h-6 w-6 text-green-500" />,
    destructive: <XCircle className="h-6 w-6 text-destructive" />,
    warning: <AlertTriangle className="h-6 w-6 text-yellow-500" />,
}

export function Notification({ title, description, variant = 'default' }: NotificationCardProps) {
    const icon = ICONS[variant] || ICONS.default;

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20, transition: { duration: 0.2 } }}
      transition={{
        type: "spring",
        stiffness: 100,
        damping: 10,
        duration: 0.6,
      }}
      className="relative mx-auto max-w-sm w-full overflow-hidden rounded-lg bg-card shadow-lg border"
      role="alert"
      aria-live="polite"
      layout
    >
      <div className="p-4">
        <div className="flex items-start gap-4">
            <div className="flex-shrink-0 mt-0.5">
                {icon}
            </div>
            <div className="flex-1">
                {title && <h3 className="text-sm font-semibold text-card-foreground">{title}</h3>}
                {description && <div className="text-sm text-muted-foreground mt-1">{description}</div>}
            </div>
        </div>
      </div>
    </motion.div>
  );
};
