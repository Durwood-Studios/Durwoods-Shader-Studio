"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

interface NumberScrubProps {
	label: string;
	min: number;
	max: number;
	value: number;
	defaultValue?: number;
	decimals: number;
	step: number;
	onChange: (value: number) => void;
}

/** Pixels of movement required before a pointer-down is treated as a drag. */
const DRAG_THRESHOLD = 3;

function clamp(v: number, lo: number, hi: number) {
	return Math.min(hi, Math.max(lo, v));
}

/** Returns pixels-per-unit speed based on modifier keys. */
function dragSpeed(range: number, shiftKey: boolean, altKey: boolean): number {
	if (shiftKey) return range / 2000; // precise
	if (altKey) return range / 20; // coarse
	return range / 200; // normal
}

export function NumberScrub({
	label,
	min,
	max,
	value,
	defaultValue,
	decimals,
	step: _step,
	onChange,
}: NumberScrubProps) {
	const id = useId();
	const range = max - min;

	// ── Editing state ──────────────────────────────────────────────────────────
	const [editing, setEditing] = useState(false);
	const [editText, setEditText] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);

	// ── Drag state (all in refs to avoid stale closure / re-render on each px) ─
	const isDragging = useRef(false);
	const dragStartX = useRef(0);
	const dragStartValue = useRef(0);
	const totalMovement = useRef(0);
	const lastEmittedValue = useRef(value);

	// ── Hover state (for the ±arrow hint) ─────────────────────────────────────
	const [hovered, setHovered] = useState(false);

	// ── Pointer-capture scrub ──────────────────────────────────────────────────
	const handlePointerDown = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			if (editing) return;
			// Only primary button
			if (e.button !== 0) return;
			e.preventDefault();
			(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
			isDragging.current = true;
			dragStartX.current = e.clientX;
			dragStartValue.current = value;
			totalMovement.current = 0;
			lastEmittedValue.current = value;
		},
		[editing, value],
	);

	const handlePointerMove = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			if (!isDragging.current) return;
			const dx = e.clientX - dragStartX.current;
			totalMovement.current = Math.abs(dx);
			const speed = dragSpeed(range, e.shiftKey, e.altKey);
			const raw = dragStartValue.current + dx * speed;
			const clamped = clamp(raw, min, max);
			if (clamped !== lastEmittedValue.current) {
				lastEmittedValue.current = clamped;
				onChange(clamped);
			}
		},
		[range, min, max, onChange],
	);

	const handlePointerUp = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			if (!isDragging.current) return;
			isDragging.current = false;
			(e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);

			// Short tap → open keyboard edit
			if (totalMovement.current < DRAG_THRESHOLD) {
				setEditText(value.toFixed(decimals));
				setEditing(true);
			}
		},
		[value, decimals],
	);

	const handlePointerCancel = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
		isDragging.current = false;
		(e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
	}, []);

	// ── Focus the real input when editing starts ───────────────────────────────
	useEffect(() => {
		if (editing) {
			inputRef.current?.focus();
			inputRef.current?.select();
		}
	}, [editing]);

	// ── Double-click to reset ──────────────────────────────────────────────────
	const handleDoubleClick = useCallback(() => {
		if (defaultValue !== undefined) {
			onChange(clamp(defaultValue, min, max));
		}
	}, [defaultValue, min, max, onChange]);

	// ── Commit keyboard edit ───────────────────────────────────────────────────
	function commitEdit() {
		const parsed = Number.parseFloat(editText);
		if (!Number.isNaN(parsed)) {
			onChange(clamp(parsed, min, max));
		}
		setEditing(false);
	}

	function handleEditKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
		if (e.key === "Enter") {
			e.preventDefault();
			commitEdit();
		} else if (e.key === "Escape") {
			setEditing(false);
		}
	}

	// ── Keyboard nudging (on the scrub div) ────────────────────────────────────
	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLDivElement>) => {
			let delta = 0;
			const nudge = e.shiftKey ? range / 1000 : e.altKey ? range / 10 : range / 100;
			switch (e.key) {
				case "ArrowUp":
				case "ArrowRight":
					delta = nudge;
					break;
				case "ArrowDown":
				case "ArrowLeft":
					delta = -nudge;
					break;
				case "PageUp":
					delta = range / 10;
					break;
				case "PageDown":
					delta = -(range / 10);
					break;
				case "Home":
					onChange(min);
					e.preventDefault();
					return;
				case "End":
					onChange(max);
					e.preventDefault();
					return;
				default:
					return;
			}
			e.preventDefault();
			onChange(clamp(value + delta, min, max));
		},
		[value, min, max, range, onChange],
	);

	// ── Scroll wheel scrub (only when focused, so we don't hijack page scroll) ─
	const scrubRef = useRef<HTMLDivElement>(null);
	const isFocused = useRef(false);

	const handleFocus = useCallback(() => {
		isFocused.current = true;
	}, []);
	const handleBlur = useCallback(() => {
		isFocused.current = false;
	}, []);

	useEffect(() => {
		const el = scrubRef.current;
		if (!el) return;

		function onWheel(e: WheelEvent) {
			if (!isFocused.current) return;
			e.preventDefault();
			const speed = dragSpeed(range, e.shiftKey, e.altKey);
			// deltaY: negative = scroll up = increase
			const delta = -Math.sign(e.deltaY) * speed * 10;
			onChange(clamp(value + delta, min, max));
		}

		el.addEventListener("wheel", onWheel, { passive: false });
		return () => el.removeEventListener("wheel", onWheel);
	}, [value, min, max, range, onChange]);

	// ── Render ─────────────────────────────────────────────────────────────────
	const displayValue = value.toFixed(decimals);

	return (
		<div className="relative flex items-center">
			{/* Scrub handle — visible when not editing */}
			{!editing && (
				<div
					ref={scrubRef}
					role="spinbutton"
					aria-label={`${label} value`}
					aria-valuenow={value}
					aria-valuemin={min}
					aria-valuemax={max}
					tabIndex={0}
					onPointerDown={handlePointerDown}
					onPointerMove={handlePointerMove}
					onPointerUp={handlePointerUp}
					onPointerCancel={handlePointerCancel}
					onDoubleClick={handleDoubleClick}
					onKeyDown={handleKeyDown}
					onFocus={handleFocus}
					onBlur={handleBlur}
					onMouseEnter={() => setHovered(true)}
					onMouseLeave={() => setHovered(false)}
					className={[
						"flex w-16 select-none items-center justify-end gap-0.5",
						"rounded bg-neutral-800 px-1.5 py-0.5",
						"border border-neutral-700 text-xs text-neutral-200",
						"cursor-ew-resize",
						// Focus ring matching the rest of the UI
						"focus:outline-none focus-visible:ring-1 focus-visible:ring-violet-500",
						// High-contrast mode focus
						"forced-colors:focus-visible:outline forced-colors:focus-visible:outline-2",
					].join(" ")}
					style={{ touchAction: "none" }}
				>
					{/* ±arrow hint on hover */}
					{hovered && (
						<span
							aria-hidden="true"
							className="pointer-events-none text-neutral-500"
							style={{ fontSize: "9px", lineHeight: 1 }}
						>
							⇄
						</span>
					)}
					<span className="tabular-nums">{displayValue}</span>
				</div>
			)}

			{/* Real text input — shown only during keyboard editing */}
			{editing && (
				<input
					ref={inputRef}
					id={id}
					type="text"
					inputMode="decimal"
					value={editText}
					onChange={(e) => setEditText(e.target.value)}
					onBlur={commitEdit}
					onKeyDown={handleEditKeyDown}
					aria-label={`${label} value`}
					className={[
						"w-16 rounded bg-neutral-800 px-1.5 py-0.5",
						"border border-violet-500 text-right text-xs text-neutral-200",
						"focus:outline-none focus:ring-1 focus:ring-violet-500",
					].join(" ")}
				/>
			)}
		</div>
	);
}
