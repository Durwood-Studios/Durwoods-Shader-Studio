"use client";

import { useCallback, useId } from "react";
import { NumberScrub } from "./NumberScrub";

interface SliderProps {
	label: string;
	name: string;
	min: number;
	max: number;
	step?: number;
	value: number;
	defaultValue?: number;
	onChange: (value: number) => void;
}

/** Auto-pick decimal places based on range magnitude. */
function decimalsForRange(range: number): number {
	if (range <= 1) return 3;
	if (range <= 10) return 2;
	if (range <= 100) return 1;
	return 0;
}

function clamp(v: number, lo: number, hi: number) {
	return Math.min(hi, Math.max(lo, v));
}

export function Slider({
	label,
	name,
	min,
	max,
	step,
	value,
	defaultValue,
	onChange,
}: SliderProps) {
	const id = useId();
	const range = max - min;
	const resolvedStep = step ?? range / 255;
	const decimals = decimalsForRange(range);

	// Fraction 0‒1 for the track fill gradient
	const pct = range > 0 ? ((value - min) / range) * 100 : 0;

	const handleRange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			onChange(clamp(Number.parseFloat(e.target.value), min, max));
		},
		[min, max, onChange],
	);

	return (
		<div className="flex flex-col gap-1">
			{/* Label row */}
			<div className="flex items-center justify-between gap-2">
				<label
					htmlFor={id}
					className="min-w-0 flex-1 select-none truncate text-xs font-medium text-neutral-400"
				>
					{label}
				</label>

				{/* Scrub-capable number display */}
				<NumberScrub
					label={label}
					min={min}
					max={max}
					value={value}
					defaultValue={defaultValue}
					decimals={decimals}
					step={resolvedStep}
					onChange={onChange}
				/>
			</div>

			{/* Range track — py-2.5 enlarges the hit area to ≥44 px without inflating the visible track */}
			<div className="py-2.5">
				<input
					id={id}
					type="range"
					name={name}
					min={min}
					max={max}
					step={resolvedStep}
					value={value}
					onChange={handleRange}
					aria-label={label}
					aria-valuemin={min}
					aria-valuemax={max}
					aria-valuenow={value}
					className={[
						"h-1.5 w-full cursor-pointer appearance-none rounded-full",
						// Track fill: gradient from violet to neutral, breakpoint at current value
						"[&::-webkit-slider-runnable-track]:rounded-full",
						// Thumb
						"[&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5",
						"[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full",
						"[&::-webkit-slider-thumb]:bg-violet-500 [&::-webkit-slider-thumb]:cursor-pointer",
						"[&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:duration-75",
						// Firefox
						"[&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5",
						"[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0",
						"[&::-moz-range-thumb]:bg-violet-500 [&::-moz-range-thumb]:cursor-pointer",
						"[&::-moz-range-track]:rounded-full [&::-moz-range-track]:h-1.5",
						// Focus ring
						"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
						"focus-visible:ring-offset-1 focus-visible:ring-offset-neutral-900",
					].join(" ")}
					style={{
						// Gradient track fill: filled portion is violet, remainder is neutral-700
						background: `linear-gradient(to right, rgb(139 92 246) 0%, rgb(139 92 246) ${pct}%, rgb(64 64 64) ${pct}%, rgb(64 64 64) 100%)`,
					}}
				/>
			</div>
		</div>
	);
}
