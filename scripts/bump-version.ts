#!/usr/bin/env tsx
/**
 * Version bumper for shader-studio.
 *
 * Scheme (per project convention):
 *   Large dev  → +1.0   (major += 1, minor stays)    e.g. 0.12 → 1.12
 *   Small dev  → +0.01  (minor += 1, as integer)     e.g. 0.12 → 0.13
 *
 * Versions are stored as `MAJOR.MINOR.0` in package.json so semver tooling
 * still works. MINOR is an integer counter; the "+0.01" framing is just how
 * humans read it (0.01, 0.02, ..., 0.99, 0.100 is valid here).
 *
 * Usage:
 *   pnpm ver:large                 # +1.0
 *   pnpm ver:small                 # +0.01
 *   tsx scripts/bump-version.ts --large --note "monaco + worker sandbox"
 */

import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

type Kind = "large" | "small";

const args = process.argv.slice(2);
const kind: Kind | null = args.includes("--large")
	? "large"
	: args.includes("--small")
		? "small"
		: null;

if (!kind) {
	console.error('usage: bump-version --large | --small [--note "..."]');
	process.exit(1);
}

const noteIdx = args.indexOf("--note");
const note = noteIdx >= 0 ? (args[noteIdx + 1] ?? "") : "";

const root = resolve(process.cwd());
const pkgPath = resolve(root, "package.json");
const changelogPath = resolve(root, "CHANGELOG.md");

const pkgRaw = readFileSync(pkgPath, "utf8");
const pkg = JSON.parse(pkgRaw) as { version: string; [k: string]: unknown };

const parts = pkg.version.split(".");
if (parts.length < 2) {
	console.error(`unreadable version: ${pkg.version}`);
	process.exit(1);
}
const major = Number.parseInt(parts[0] ?? "0", 10);
const minor = Number.parseInt(parts[1] ?? "0", 10);
if (Number.isNaN(major) || Number.isNaN(minor)) {
	console.error(`unreadable version: ${pkg.version}`);
	process.exit(1);
}

const next = kind === "large" ? { major: major + 1, minor } : { major, minor: minor + 1 };

const nextVersion = `${next.major}.${next.minor}.0`;
const prevVersion = pkg.version;

pkg.version = nextVersion;
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, "\t")}\n`);

const stamp = new Date().toISOString().slice(0, 10);
const entry = `\n## ${nextVersion} — ${stamp} (${kind})${note ? `\n\n- ${note}` : ""}\n`;

if (!existsSync(changelogPath)) {
	writeFileSync(
		changelogPath,
		`# Changelog\n\nAll notable changes to shader-studio.\nVersion scheme: large dev +1.0, small dev +0.01 (see scripts/bump-version.ts).\n${entry}`,
	);
} else {
	appendFileSync(changelogPath, entry);
}

console.log(`${prevVersion} → ${nextVersion} (${kind})${note ? `  "${note}"` : ""}`);
