"use client";

import { type ChangeEvent, useId } from "react";

interface SliderProps {
	label: string;
	name: string;
	min: number;
	max: number;
	step?: number;
	value: number;
	onChange: (value: number) => void;
}

export function Slider({ label, name, min, max, step = 0.001, value, onChange }: SliderProps) {
	const id = useId();
	const numberId = `${id}-num`;

	function handleRange(e: ChangeEvent<HTMLInputElement>) {
		onChange(Number.parseFloat(e.target.value));
	}

	function handleNumber(e: ChangeEvent<HTMLInputElement>) {
		const parsed = Number.parseFloat(e.target.value);
		if (!Number.isNaN(parsed)) {
			onChange(Math.min(max, Math.max(min, parsed)));
		}
	}

	const displayStep = step < 0.01 ? 0.001 : step < 0.1 ? 0.01 : 0.1;
	const decimals = step < 0.01 ? 3 : step < 0.1 ? 2 : 1;

	return (
		<div className="flex flex-col gap-1">
			<div className="flex items-center justify-between">
				<label htmlFor={id} className="text-xs font-medium text-neutral-400 select-none md:text-xs">
					{label}
				</label>
				<input
					id={numberId}
					type="number"
					min={min}
					max={max}
					step={displayStep}
					value={value.toFixed(decimals)}
					onChange={handleNumber}
					aria-label={`${label} value`}
					className={[
						"w-16 rounded bg-neutral-800 px-1.5 py-0.5 text-right text-xs text-neutral-200",
						"border border-neutral-700 focus:outline-none focus:ring-1 focus:ring-violet-500",
					].join(" ")}
				/>
			</div>
			{/* py-2.5 enlarges the hit area to ≥44px without inflating the visible track */}
			<div className="py-2.5">
				<input
					id={id}
					type="range"
					min={min}
					max={max}
					step={step}
					value={value}
					onChange={handleRange}
					aria-label={label}
					aria-valuemin={min}
					aria-valuemax={max}
					aria-valuenow={value}
					name={name}
					className={[
						"h-1.5 w-full cursor-pointer appearance-none rounded-full bg-neutral-700",
						"accent-violet-500",
						// Larger thumb for touch targets (≥44px via py-2.5 wrapper)
						"[&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5",
						"[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full",
						"[&::-webkit-slider-thumb]:bg-violet-500 [&::-webkit-slider-thumb]:cursor-pointer",
						"[&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5",
						"[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0",
						"[&::-moz-range-thumb]:bg-violet-500 [&::-moz-range-thumb]:cursor-pointer",
						"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-1 focus-visible:ring-offset-neutral-900",
					].join(" ")}
				/>
			</div>
		</div>
	);
}
