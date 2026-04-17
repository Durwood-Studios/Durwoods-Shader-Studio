"use client";

import type { ButtonHTMLAttributes } from "react";

interface ToggleProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
	pressed: boolean;
	onPressedChange: (pressed: boolean) => void;
	label?: string;
}

/**
 * Small reusable toggle button. Renders as an ARIA-compliant button[aria-pressed].
 * Styling shows a violet accent when pressed, neutral when not.
 * min-h-[44px] / min-w-[44px] meets the 44px tap-target requirement on all devices.
 */
export function Toggle({
	pressed,
	onPressedChange,
	label,
	children,
	className = "",
	...rest
}: ToggleProps) {
	return (
		<button
			type="button"
			aria-pressed={pressed}
			aria-label={label}
			onClick={() => onPressedChange(!pressed)}
			className={[
				"inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
				"min-h-[44px] min-w-[44px]",
				"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950",
				"disabled:pointer-events-none disabled:opacity-40",
				// Suppress tap highlight — we use custom focus rings
				"[-webkit-tap-highlight-color:transparent]",
				pressed
					? "bg-violet-600/20 text-violet-300 border border-violet-600/40"
					: "border border-neutral-700 bg-transparent text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200",
				className,
			].join(" ")}
			{...rest}
		>
			{children}
		</button>
	);
}
