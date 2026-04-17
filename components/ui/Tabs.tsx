"use client";

import { type KeyboardEvent, type ReactNode, createContext, useContext, useState } from "react";

interface TabsContextValue {
	active: string;
	setActive: (id: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext() {
	const ctx = useContext(TabsContext);
	if (!ctx) throw new Error("Tabs sub-component used outside <Tabs />");
	return ctx;
}

interface TabsProps {
	defaultTab: string;
	children: ReactNode;
	className?: string;
}

export function Tabs({ defaultTab, children, className = "" }: TabsProps) {
	const [active, setActive] = useState(defaultTab);
	return (
		<TabsContext.Provider value={{ active, setActive }}>
			<div className={className}>{children}</div>
		</TabsContext.Provider>
	);
}

interface TabListProps {
	children: ReactNode;
	className?: string;
}

export function TabList({ children, className = "" }: TabListProps) {
	return (
		<div role="tablist" className={["flex gap-1", className].join(" ")}>
			{children}
		</div>
	);
}

interface TabTriggerProps {
	id: string;
	children: ReactNode;
}

export function TabTrigger({ id, children }: TabTriggerProps) {
	const { active, setActive } = useTabsContext();
	const isActive = active === id;

	function handleKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			setActive(id);
		}
	}

	return (
		<button
			type="button"
			role="tab"
			aria-selected={isActive}
			aria-controls={`tabpanel-${id}`}
			id={`tab-${id}`}
			onClick={() => setActive(id)}
			onKeyDown={handleKeyDown}
			className={[
				"rounded px-3 py-1.5 text-sm font-medium transition-colors",
				"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
				isActive ? "bg-neutral-800 text-neutral-100" : "text-neutral-400 hover:text-neutral-200",
			].join(" ")}
		>
			{children}
		</button>
	);
}

interface TabPanelProps {
	id: string;
	children: ReactNode;
	className?: string;
}

export function TabPanel({ id, children, className = "" }: TabPanelProps) {
	const { active } = useTabsContext();
	if (active !== id) return null;
	return (
		<div role="tabpanel" id={`tabpanel-${id}`} aria-labelledby={`tab-${id}`} className={className}>
			{children}
		</div>
	);
}
