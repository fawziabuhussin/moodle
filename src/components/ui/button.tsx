import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-[background-color,box-shadow,transform,color,border-color] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-b from-sky-500 to-sky-600 text-primary-foreground shadow-[0_1px_0_rgb(255_255_255/0.25)_inset,0_6px_16px_-6px_rgb(13_114_184/0.6)] hover:from-sky-400 hover:to-sky-600 hover:shadow-[0_1px_0_rgb(255_255_255/0.3)_inset,0_10px_22px_-8px_rgb(13_114_184/0.7)]",
        secondary: "bg-secondary text-secondary-foreground ring-1 ring-slate-200/70 hover:bg-slate-200/70",
        outline: "border border-slate-200 bg-card shadow-xs hover:border-sky-200 hover:bg-sky-50/60 hover:text-sky-800",
        ghost: "hover:bg-slate-100",
        destructive: "bg-gradient-to-b from-rose-500 to-rose-600 text-white shadow-[0_6px_16px_-6px_rgb(225_29_72/0.55)] hover:from-rose-400",
        brand: "bg-brand-gradient text-white shadow-[0_8px_24px_-8px_rgb(26_143_216/0.55)] hover:brightness-110",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-12 rounded-2xl px-6 text-[15px]",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
