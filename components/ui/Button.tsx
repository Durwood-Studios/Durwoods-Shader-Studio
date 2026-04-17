"use client";

import { type ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "ghost" | "outline";
type Size = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: Variant;
	size?: Size;
}

const variantClasses: Record<Variant, string> = {
	primary: "bg-violet-600 text-white hover:bg-violet-500 focus-visible:ring-violet-500",
	ghost: "bg-transparent text-neutral-300 hover:bg-neutral-800 focus-visible:ring-neutral-500",
	outline:
		"border border-neutral-700 bg-transparent text-neutral-300 hover:bg-neutral-800 focus-visible:ring-neutral-500",
};

const sizeClasses: Record<Size, string> = {
	// min-h-[44px] ensures the tap target meets the 44px minimum on all devices
	sm: "px-2.5 py-1 text-xs min-h-[44px]",
	md: "px-3.5 py-1.5 text-sm min-h-[44px]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
	{ variant = "ghost", size = "md", className = "", children, ...rest },
	ref,
) {
	return (
		<button
			ref={ref}
			className={[
				"inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors",
				"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950",
				"disabled:pointer-events-none disabled:opacity-40",
				// Suppress tap highlight — we use custom focus rings
				"[-webkit-tap-highlight-color:transparent]",
				variantClasses[variant],
				sizeClasses[size],
				className,
			].join(" ")}
			{...rest}
		>
			{children}
		</button>
	);
});
