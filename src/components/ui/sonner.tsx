"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "@/components/kit/icons"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4 text-leaf-500" />,
        info: <InfoIcon className="size-4 text-teal-600" />,
        warning: <TriangleAlertIcon className="size-4 text-sun-500" />,
        error: <OctagonXIcon className="size-4 text-coral-500" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast !shadow-pop !border-transparent",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
