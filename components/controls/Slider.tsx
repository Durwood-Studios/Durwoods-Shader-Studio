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
				<label htmlFor={id} className="text-xs font-medium text-neutral-400 select-none">
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
					"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-1 focus-visible:ring-offset-neutral-900",
				].join(" ")}
			/>
		</div>
	);
}
