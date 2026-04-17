"use client";

import { Component, type ReactNode } from "react";

interface Props {
	children: ReactNode;
	fallback?: (error: Error, reset: () => void) => ReactNode;
	onError?: (error: Error) => void;
}

interface State {
	error: Error | null;
}

function DefaultErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
	const msg = error.message.length > 200 ? `${error.message.slice(0, 200)}…` : error.message;

	return (
		<div className="flex h-full min-h-[120px] items-center justify-center p-4">
			<div className="w-full max-w-sm rounded-xl border border-neutral-700 bg-neutral-900 p-5 shadow-xl">
				<p className="mb-1 text-xs font-semibold uppercase tracking-wider text-red-400">
					{error.name || "Error"}
				</p>
				<p className="mb-4 text-sm text-neutral-300">{msg}</p>
				<button
					type="button"
					onClick={reset}
					className={[
						"rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white",
						"hover:bg-violet-500 transition-colors",
						"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400",
					].join(" ")}
				>
					Try again
				</button>
			</div>
		</div>
	);
}

export class ErrorBoundary extends Component<Props, State> {
	state: State = { error: null };

	static getDerivedStateFromError(error: Error): State {
		return { error };
	}

	componentDidCatch(error: Error) {
		this.props.onError?.(error);
	}

	reset = () => this.setState({ error: null });

	render() {
		if (this.state.error) {
			return this.props.fallback ? (
				this.props.fallback(this.state.error, this.reset)
			) : (
				<DefaultErrorFallback error={this.state.error} reset={this.reset} />
			);
		}
		return this.props.children;
	}
}
