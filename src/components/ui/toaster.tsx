
"use client"

import { useToast } from "@/hooks/use-toast"
import { AnimatePresence } from "framer-motion";
import { Notification } from "./notification";
import { ToastProvider, ToastViewport } from "./toast";

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
        <ToastViewport>
            <AnimatePresence>
                {toasts.map(function ({ id, title, description, action, ...props }) {
                    return (
                    <Notification
                        key={id}
                        id={id}
                        title={title}
                        description={description}
                        {...props}
                    />
                    )
                })}
            </AnimatePresence>
      </ToastViewport>
    </ToastProvider>
  )
}
