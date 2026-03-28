<script setup lang="ts">
import {
	computed,
	defineAsyncComponent,
	onBeforeUnmount,
	onMounted,
	ref,
	watch,
} from "vue";
import defaultSnapshot from "~/data/incidents.generated.json";
import { buildSnapshot, parseCsv } from "~/lib/incidents-data.mjs";

type Snapshot = typeof defaultSnapshot;
type Incident = Snapshot["incidents"][number];

const runtimeConfig = useRuntimeConfig();
const route = useRoute();
const isDev = import.meta.dev;
const AsyncAnalyticsCharts = defineAsyncComponent(
	() => import("~/components/AnalyticsCharts.client.vue"),
);
const AsyncIncidentGrid = defineAsyncComponent(
	() => import("~/components/IncidentGrid.client.vue"),
);

function normalizeBaseUrl(value: string) {
	return value.replace(/\/+$/, "");
}

const siteUrl = computed(() => {
	const configured = String(runtimeConfig.public.siteUrl || "").trim();
	if (!configured) {
		return "";
	}

	try {
		return normalizeBaseUrl(new URL(configured).toString());
	} catch {
		return "";
	}
});

const socialImageUrl = computed(() => {
	const configured = String(runtimeConfig.public.socialImageUrl || "").trim();
	if (!configured) {
		return "";
	}

	if (/^https?:\/\//i.test(configured)) {
		return configured;
	}

	if (!siteUrl.value) {
		return "";
	}

	return new URL(configured.replace(/^\//, ""), `${siteUrl.value}/`).toString();
});

const pageTitle = "ICCU Incident Tracker — E-GMP Electric Vehicles";
const pageDescription =
	"Community-driven analytics for reported E-GMP ICCU-related incidents. Explore reported patterns by model, mileage, build date, and recall status.";
const canonicalUrl = computed(() => {
	if (!siteUrl.value) {
		return "";
	}

	const path = route.path === "/" ? "" : route.path;
	return `${siteUrl.value}${path}`;
});
const githubRepoUrl = computed(
	() =>
		runtimeConfig.public.githubRepoUrl ||
		"https://github.com/your-org/your-repo",
);
const githubRepoPath = computed(() => {
	const match = githubRepoUrl.value.match(
		/^https:\/\/github\.com\/([^/]+)\/([^/?#]+?)(?:\.git)?(?:[/?#].*)?$/i,
	);
	if (!match) {
		return null;
	}

	const owner = match[1];
	const repo = match[2];

	if (owner === "your-org" && repo === "your-repo") {
		return null;
	}

	return { owner, repo };
});
const githubIssuesUrl = computed(
	() => `${githubRepoUrl.value.replace(/\/$/, "")}/issues`,
);
const githubPullsUrl = computed(
	() => `${githubRepoUrl.value.replace(/\/$/, "")}/pulls`,
);
const githubStars = ref(
	Number.parseInt(
		String(runtimeConfig.public.githubStarsFallback || "0"),
		10,
	) || 0,
);
const githubStarsLabel = computed(() =>
	new Intl.NumberFormat("en", {
		notation: "compact",
		maximumFractionDigits: 1,
	}).format(githubStars.value),
);

useSeoMeta({
	title: pageTitle,
	description: pageDescription,
	ogTitle: pageTitle,
	ogDescription: pageDescription,
	ogType: "website",
	ogUrl: () => canonicalUrl.value || undefined,
	ogImage: () => socialImageUrl.value || undefined,
	twitterCard: () =>
		(socialImageUrl.value ? "summary_large_image" : "summary") as
			| "summary"
			| "summary_large_image",
	twitterTitle: pageTitle,
	twitterDescription: pageDescription,
	twitterImage: () => socialImageUrl.value || undefined,
});

useHead(() => ({
	title: pageTitle,
	link: canonicalUrl.value
		? [
				{
					rel: "canonical",
					href: canonicalUrl.value,
				},
			]
		: [],
	script: [
		{
			type: "application/ld+json",
			innerHTML: JSON.stringify({
				"@context": "https://schema.org",
				"@graph": [
					{
						"@type": "WebSite",
						name: "ICCU Incident Tracker",
						description: pageDescription,
						url: canonicalUrl.value || undefined,
					},
					{
						"@type": "Dataset",
						name: "Reported ICCU incident dataset",
						description:
							"An anonymized community-maintained dataset of reported ICCU-related incidents in E-GMP vehicles.",
						url: canonicalUrl.value || undefined,
						includedInDataCatalog: {
							"@type": "DataCatalog",
							name: "ICCU Incident Tracker",
						},
					},
				],
			}),
		},
	],
}));

const snapshot = ref(defaultSnapshot as Snapshot);
const isLiveDataLoading = ref(false);
const liveDataError = ref("");
const incidents = computed(() => snapshot.value.incidents as Incident[]);

const mobileNavOpen = ref(false);
const currentSection = ref("overview");
const navSectionIds = [
	"overview",
	"analytics",
	"data-table",
	"how-to-contribute",
] as const;
let navObserver: IntersectionObserver | null = null;

function toggleNav() {
	mobileNavOpen.value = !mobileNavOpen.value;
}
function closeNav() {
	mobileNavOpen.value = false;
}

function scrollToSection(sectionId: (typeof navSectionIds)[number]) {
	document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth" });
	currentSection.value = sectionId;
	closeNav();
}

async function refreshGitHubStars() {
	if (!githubRepoPath.value) {
		return;
	}

	try {
		const data = await $fetch<{ stargazers_count?: number }>(
			`https://api.github.com/repos/${githubRepoPath.value.owner}/${githubRepoPath.value.repo}`,
			{
				headers: {
					Accept: "application/vnd.github+json",
				},
			},
		);

		if (typeof data.stargazers_count === "number") {
			githubStars.value = data.stargazers_count;
		}
	} catch {
		// Keep the configured fallback if the GitHub API is unavailable or rate-limited.
	}
}

// ── Filters ──────────────────────────────────────────────
const selectedModel = ref("all");
const selectedRegion = ref("all");
const selectedBuildYear = ref("all");
const selectedBuildMonth = ref("all");
const selectedRecall = ref("all");
const syncingFiltersFromRoute = ref(false);
const FILTER_QUERY_KEYS = {
	model: "model",
	region: "region",
	buildYear: "buildYear",
	buildMonth: "buildMonth",
	recall: "recall",
} as const;

const modelOptions = computed(() => [
	"all",
	...new Set(incidents.value.map((incident) => incident.model).filter(Boolean)),
]);
const regionOptions = computed(() => [
	"all",
	...new Set(
		incidents.value
			.map((incident) => incident.region || "unknown")
			.filter(Boolean),
	),
]);
const buildYearOptions = computed(() => [
	"all",
	...new Set(
		incidents.value.map((incident) => String(incident.buildYear || "unknown")),
	),
]);
const buildMonthOptions = computed(() => [
	"all",
	...new Set(
		incidents.value.map((incident) => String(incident.buildMonth || "unknown")),
	),
]);

function getQueryValue(value: string | string[] | undefined) {
	if (Array.isArray(value)) {
		return value[0] || "";
	}

	return value || "";
}

function resolveFilterValue(
	rawValue: string | string[] | undefined,
	options: string[],
) {
	const nextValue = getQueryValue(rawValue);
	return options.includes(nextValue) ? nextValue : "all";
}

function syncFiltersFromQuery() {
	syncingFiltersFromRoute.value = true;
	selectedModel.value = resolveFilterValue(
		route.query[FILTER_QUERY_KEYS.model],
		modelOptions.value,
	);
	selectedRegion.value = resolveFilterValue(
		route.query[FILTER_QUERY_KEYS.region],
		regionOptions.value,
	);
	selectedBuildYear.value = resolveFilterValue(
		route.query[FILTER_QUERY_KEYS.buildYear],
		buildYearOptions.value,
	);
	selectedBuildMonth.value = resolveFilterValue(
		route.query[FILTER_QUERY_KEYS.buildMonth],
		buildMonthOptions.value,
	);
	selectedRecall.value = resolveFilterValue(
		route.query[FILTER_QUERY_KEYS.recall],
		["all", "yes", "no", "unknown"],
	);
	syncingFiltersFromRoute.value = false;
}

const activeFilterCount = computed(() => {
	let count = 0;
	if (selectedModel.value !== "all") count++;
	if (selectedRegion.value !== "all") count++;
	if (selectedBuildYear.value !== "all") count++;
	if (selectedBuildMonth.value !== "all") count++;
	if (selectedRecall.value !== "all") count++;
	return count;
});

function resetFilters() {
	selectedModel.value = "all";
	selectedRegion.value = "all";
	selectedBuildYear.value = "all";
	selectedBuildMonth.value = "all";
	selectedRecall.value = "all";
}

function buildFilterQuery() {
	const nextQuery = import.meta.client
		? Object.fromEntries(new URLSearchParams(window.location.search).entries())
		: { ...route.query };
	const filterEntries = [
		[FILTER_QUERY_KEYS.model, selectedModel.value],
		[FILTER_QUERY_KEYS.region, selectedRegion.value],
		[FILTER_QUERY_KEYS.buildYear, selectedBuildYear.value],
		[FILTER_QUERY_KEYS.buildMonth, selectedBuildMonth.value],
		[FILTER_QUERY_KEYS.recall, selectedRecall.value],
	] as const;

	for (const [queryKey, value] of filterEntries) {
		if (value === "all") {
			delete nextQuery[queryKey];
		} else {
			nextQuery[queryKey] = value;
		}
	}

	return nextQuery;
}

function downloadJson(filename: string, content: unknown) {
	const blob = new Blob([`${JSON.stringify(content, null, 2)}\n`], {
		type: "application/json;charset=utf-8",
	});
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	link.click();
	URL.revokeObjectURL(url);
}

function escapeCsvCell(value: unknown) {
	const normalized =
		value == null
			? ""
			: typeof value === "string"
				? value
				: String(value);
	return `"${normalized.replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
	if (!rows.length) {
		return;
	}

	const headers = Object.keys(rows[0]);
	const csvLines = [
		headers.map((header) => escapeCsvCell(header)).join(","),
		...rows.map((row) =>
			headers.map((header) => escapeCsvCell(row[header])).join(","),
		),
	];
	const blob = new Blob([`${csvLines.join("\n")}\n`], {
		type: "text/csv;charset=utf-8",
	});
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	link.click();
	URL.revokeObjectURL(url);
}

function downloadSnapshotJson() {
	downloadJson("iccu-dataset-snapshot.json", snapshot.value);
}

function downloadSnapshotCsv() {
	downloadCsv(
		"iccu-dataset-snapshot.csv",
		snapshot.value.incidents as Record<string, unknown>[],
	);
}

const filteredIncidents = computed(() => {
	return incidents.value.filter((incident) => {
		if (
			selectedModel.value !== "all" &&
			incident.model !== selectedModel.value
		) {
			return false;
		}
		if (
			selectedRegion.value !== "all" &&
			(incident.region || "unknown") !== selectedRegion.value
		) {
			return false;
		}
		if (
			selectedBuildYear.value !== "all" &&
			String(incident.buildYear || "unknown") !== selectedBuildYear.value
		) {
			return false;
		}
		if (
			selectedBuildMonth.value !== "all" &&
			String(incident.buildMonth || "unknown") !== selectedBuildMonth.value
		) {
			return false;
		}
		if (
			selectedRecall.value !== "all" &&
			incident.recall41d033Done !== selectedRecall.value
		) {
			return false;
		}
		return true;
	});
});

const filteredStats = computed(() => {
	const list = filteredIncidents.value;
	const total = incidents.value.length;
	const kmValues = list
		.map((incident) => incident.odometerKmAtFailure)
		.filter((value): value is number => value != null);
	const averageKm =
		kmValues.length > 0
			? Math.round(
					kmValues.reduce((sum, value) => sum + value, 0) / kmValues.length,
				)
			: null;
	const repeatCount = list.filter(
		(incident) => incident.isRepeatFailure,
	).length;
	const afterRecallCount = list.filter(
		(incident) => incident.recall41d033Done === "yes",
	).length;

	return {
		incidents: list.length,
		total,
		averageKm,
		repeatCount,
		repeatPct:
			list.length > 0 ? Math.round((repeatCount / list.length) * 100) : 0,
		afterRecallCount,
		afterRecallPct:
			list.length > 0 ? Math.round((afterRecallCount / list.length) * 100) : 0,
		kmReported: kmValues.length,
	};
});

const directSubmissionShare = computed(() => {
	const published = snapshot.value.meta.publishedRows || 0;
	const direct = snapshot.value.meta.formRows || 0;
	if (published === 0) {
		return "0%";
	}

	const percentage = (direct / published) * 100;
	return percentage < 1 ? `${percentage.toFixed(1)}%` : `${Math.round(percentage)}%`;
});

watch(
	[
		() => route.query,
		modelOptions,
		regionOptions,
		buildYearOptions,
		buildMonthOptions,
	],
	() => {
		syncFiltersFromQuery();
	},
	{ immediate: true, deep: true },
);

watch(
	[
		selectedModel,
		selectedRegion,
		selectedBuildYear,
		selectedBuildMonth,
		selectedRecall,
	],
	async () => {
		if (syncingFiltersFromRoute.value) {
			return;
		}

		const nextQuery = buildFilterQuery();
		const searchParams = new URLSearchParams();

		for (const [key, value] of Object.entries(nextQuery)) {
			if (Array.isArray(value)) {
				for (const item of value) {
					searchParams.append(key, item);
				}
				continue;
			}

			if (value != null) {
				searchParams.set(key, String(value));
			}
		}

		const search = searchParams.toString();
		const nextUrl = `${route.path}${search ? `?${search}` : ""}`;
		window.history.replaceState(window.history.state, "", nextUrl);
	},
);

onMounted(async () => {
	refreshGitHubStars();

	const sectionElements = navSectionIds
		.map((id) => document.getElementById(id))
		.filter((section): section is HTMLElement => section != null);

	navObserver = new IntersectionObserver(
		(entries) => {
			const visibleEntries = entries
				.filter((entry) => entry.isIntersecting)
				.sort((a, b) => b.intersectionRatio - a.intersectionRatio);

			if (visibleEntries.length > 0) {
				currentSection.value = visibleEntries[0].target.id;
			}
		},
		{
			rootMargin: "-25% 0px -55% 0px",
			threshold: [0.15, 0.35, 0.6],
		},
	);

	sectionElements.forEach((section) => navObserver?.observe(section));

	if (!isDev || !runtimeConfig.public.googleSheetCsvUrl) {
		return;
	}

	isLiveDataLoading.value = true;
	liveDataError.value = "";

	try {
		const response = await fetch(runtimeConfig.public.googleSheetCsvUrl);
		if (!response.ok) {
			throw new Error(
				`Live sheet fetch failed: ${response.status} ${response.statusText}`,
			);
		}

		const text = await response.text();
		snapshot.value = buildSnapshot(parseCsv(text), {
			type: "google-sheet-live",
			url: runtimeConfig.public.googleSheetCsvUrl,
		}) as Snapshot;
	} catch (error) {
		liveDataError.value =
			error instanceof Error ? error.message : "Live sheet fetch failed.";
	} finally {
		isLiveDataLoading.value = false;
	}
});

onBeforeUnmount(() => {
	navObserver?.disconnect();
});
</script>

<template>
	<div>
		<!-- ═══ Sticky header with nav ═══ -->
		<header class="site-header">
			<div class="site-header-inner">
				<button class="logo logo-button" type="button" @click="scrollToSection('overview')">
					ICCU Tracker
				</button>
				<nav
					id="site-nav"
					:class="['site-nav', { open: mobileNavOpen }]"
					aria-label="Primary"
				>
					<button
						:class="['nav-link', { active: currentSection === 'overview' }]"
						:aria-current="currentSection === 'overview' ? 'page' : undefined"
						type="button"
						@click="scrollToSection('overview')"
						>Overview</button
					>
					<button
						:class="['nav-link', { active: currentSection === 'analytics' }]"
						:aria-current="currentSection === 'analytics' ? 'page' : undefined"
						type="button"
						@click="scrollToSection('analytics')"
						>Analyze</button
					>
					<button
						:class="['nav-link', { active: currentSection === 'data-table' }]"
						:aria-current="currentSection === 'data-table' ? 'page' : undefined"
						type="button"
						@click="scrollToSection('data-table')"
						>Data Table</button
					>
					<button
						:class="[
							'nav-link',
							{ active: currentSection === 'how-to-contribute' },
							]"
						:aria-current="
							currentSection === 'how-to-contribute' ? 'page' : undefined
						"
						type="button"
						@click="scrollToSection('how-to-contribute')"
						>Contribute</button
					>
				</nav>
				<button
					class="nav-toggle"
					type="button"
					aria-label="Toggle navigation"
					aria-controls="site-nav"
					:aria-expanded="mobileNavOpen ? 'true' : 'false'"
					@click="toggleNav"
				>
					{{ mobileNavOpen ? "✕" : "☰" }}
				</button>
				<div class="header-actions">
					<a
						class="github-header-link"
						:href="githubRepoUrl"
						target="_blank"
						rel="noreferrer"
						aria-label="View the project on GitHub"
					>
						<svg viewBox="0 0 24 24" aria-hidden="true">
							<path
								fill="currentColor"
								d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.38 7.86 10.9.58.11.79-.25.79-.56 0-.27-.01-1.17-.02-2.12-3.2.7-3.88-1.36-3.88-1.36-.52-1.34-1.28-1.69-1.28-1.69-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.25.45-2.27 1.18-3.07-.12-.29-.51-1.47.11-3.06 0 0 .97-.31 3.17 1.17.92-.26 1.91-.39 2.89-.4.98.01 1.97.14 2.89.4 2.2-1.49 3.17-1.17 3.17-1.17.63 1.59.24 2.77.12 3.06.73.8 1.18 1.82 1.18 3.07 0 4.41-2.69 5.39-5.25 5.67.41.36.78 1.08.78 2.18 0 1.58-.01 2.85-.01 3.24 0 .31.21.68.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z"
							/>
						</svg>
						<span>Star on GitHub</span>
						<strong>{{ githubStarsLabel }}</strong>
					</a>
					<a
						v-if="runtimeConfig.public.googleFormUrl"
						class="cta cta-sm"
						:href="runtimeConfig.public.googleFormUrl"
						target="_blank"
						rel="noreferrer"
					>
						＋ Report a Case
					</a>
				</div>
			</div>
		</header>

		<main class="page-shell">
			<!-- ═══ Hero ═══ -->
			<section id="overview" class="hero">
				<div class="hero-content">
					<div class="eyebrow">
						Open incident dataset ·
						{{ snapshot.meta.publishedRows }} reports
					</div>
					<h1>
						Tracking <span class="gradient-text">reported ICCU incidents</span> across
						E-GMP electric vehicles
					</h1>
					<p class="hero-copy">
						This site aggregates publicly submitted reports about suspected ICCU-
						related incidents in E-GMP platform vehicles into a single anonymized
						dataset. The goal is to make reported model, mileage, build-date, and
						recall patterns easier to review without relying on scattered forum
						posts or screenshots.
					</p>
					<p class="hero-disclaimer">
						Independent community project. Not affiliated with Hyundai Motor
						Group, Kia, or Genesis.
					</p>

					<div class="hero-actions">
						<a
							v-if="runtimeConfig.public.googleFormUrl"
							class="cta"
							:href="runtimeConfig.public.googleFormUrl"
							target="_blank"
							rel="noreferrer"
						>
							Report a suspected ICCU incident
						</a>
						<button
							class="ghost-button"
							type="button"
							@click="scrollToSection('analytics')"
						>
							Explore the data ↓
						</button>
					</div>
				</div>

					<div class="hero-stats">
						<div class="chip">
							<span class="chip-label">
								Total reports
								<span class="info-tooltip-wrap">
									<button
										class="info-icon"
										type="button"
										aria-label="Total reports info"
										aria-describedby="tooltip-total-reports"
									>
										i
									</button>
									<span
										id="tooltip-total-reports"
										class="info-tooltip"
										role="tooltip"
									>
										These are all published rows from the moderated export,
										including both form submissions and manually added records.
									</span>
								</span>
							</span>
							<strong>{{ snapshot.meta.publishedRows }}</strong>
						</div>
							<div class="chip">
								<span class="chip-label">
									Direct submissions
									<span class="info-tooltip-wrap">
										<button
											class="info-icon"
										type="button"
										aria-label="Total user submissions info"
										aria-describedby="tooltip-direct-submissions"
									>
										i
									</button>
									<span
										id="tooltip-direct-submissions"
										class="info-tooltip"
										role="tooltip"
									>
										Published reports submitted through the Google Form.
									</span>
								</span>
								</span>
								<strong>{{ snapshot.meta.formRows }}</strong>
							</div>
					<div class="chip">
						<span>Avg km at reported incident</span>
						<strong>{{
							snapshot.meta.averageKmAtFailure?.toLocaleString() ?? "n/a"
						}}</strong>
					</div>
					<div class="chip">
						<span class="chip-label">
							Last updated
							<span class="info-tooltip-wrap">
								<button
									class="info-icon"
									type="button"
									aria-label="Last updated info"
									aria-describedby="tooltip-last-updated"
								>
									i
								</button>
								<span
									id="tooltip-last-updated"
									class="info-tooltip"
									role="tooltip"
								>
									The site refreshes on new pushes and on the daily GitHub Pages
									refresh job.
								</span>
							</span>
						</span>
						<strong>{{ snapshot.meta.generatedAt.slice(0, 10) }}</strong>
					</div>
					</div>

				<p v-if="isDev && isLiveDataLoading" class="mini-note">
					Loading live sheet CSV…
				</p>
				<p v-else-if="liveDataError" class="mini-note">
					Live sheet fetch failed, showing generated snapshot.
					{{ liveDataError }}
				</p>
			</section>

			<!-- ═══ What is the ICCU? ═══ -->
			<section class="section">
				<div class="section-head">
					<h2>What is the ICCU issue?</h2>
					<p>
						The Integrated Charging Control Unit is an important power-electronics
						component in these vehicles. The summary below reflects general system
						function and community hypotheses, not a manufacturer-confirmed root
						cause analysis.
					</p>
				</div>

				<div class="explainer-grid">
					<div class="explainer-card">
						<div class="explainer-icon blue">⚡</div>
						<h3>What the ICCU does</h3>
						<p>
							The ICCU converts high-voltage DC from the main battery to
							12&thinsp;V to keep the auxiliary battery charged. It also enables
							Vehicle-to-Load (V2L) output. Without it, every low-voltage system
							in the car depends on that power path, including lights, displays,
							door locks, and some support systems.
						</p>
					</div>

					<div class="explainer-card">
						<div class="explainer-icon red">⚠</div>
						<h3>What owners report</h3>
						<p>
							A commonly discussed theory is that some reported incidents may
							involve electrical stress, heat, charging-related conditions, or
							other internal failure modes. In owner reports, these incidents are
							often associated with dashboard warnings, reduced power, "turtle
							mode", charging problems, or in some cases an undriveable vehicle.
							Those reports do not by themselves establish a single cause.
						</p>
					</div>

					<div class="explainer-card">
						<div class="explainer-icon purple">🚗</div>
						<h3>Which vehicles appear in reports</h3>
						<p>
							Several E-GMP models appear in public discussions about suspected
							ICCU-related incidents, including Ioniq&nbsp;5, Ioniq&nbsp;6, EV6,
							GV60, GV70 Electrified, and G80 Electrified. Public recall actions
							and service campaigns have also been discussed, but this site does
							not claim to prove which vehicles share the same underlying issue
							or whether any specific update resolves it completely.
						</p>
					</div>
				</div>
				<div class="section-card tracker-purpose-card">
					<div class="section-head">
						<h2>Why does this tracker exist?</h2>
					</div>
					<p
						style="
							color: var(--muted);
							max-width: 80ch;
							line-height: 1.7;
							margin: 0;
						"
					>
						Reports of possible ICCU-related incidents are scattered across forum
						threads, Reddit posts, and social media, which makes broader pattern
						review difficult. This project centralizes anonymized reports into a
						single, open dataset so people can explore possible correlations,
						such as build months that appear more often, mileage ranges where
						reports seem to cluster, or whether incidents are still being
						reported after specific recall actions. The dataset is intended as a
						public research aid for owners, journalists, consumer advocates, and
						safety investigators.
					</p>
				</div>
			</section>

			<!-- ═══ Live analytics ═══ -->
			<section id="analytics" class="section">
				<div class="section-head">
					<h2>Live analytics</h2>
					<p>
						Filter and explore all published incident reports in real time.
						The statistics below summarize submitted reports and should be read
						as descriptive observations, not proof of causation.
					</p>
				</div>

				<!-- Filter toolbar -->
				<div class="filter-toolbar">
					<div class="filter-toolbar-header">
						<div class="filter-toolbar-left">
							<span class="filter-toolbar-title">⚙ Filters</span>
							<span v-if="activeFilterCount > 0" class="filter-badge"
								>{{ activeFilterCount }} active</span
							>
						</div>
						<button
							v-if="activeFilterCount > 0"
							class="filter-reset"
							type="button"
							@click="resetFilters"
						>
							✕ Reset all
						</button>
					</div>

					<div class="filter-grid">
						<div
							:class="[
								'filter-card',
								'field',
								{ active: selectedModel !== 'all' },
							]"
						>
							<label for="model-filter">Model</label>
							<select id="model-filter" v-model="selectedModel">
								<option
									v-for="option in modelOptions"
									:key="option"
									:value="option"
								>
									{{ option === "all" ? "All models" : option }}
								</option>
							</select>
						</div>

						<div
							:class="[
								'filter-card',
								'field',
								{ active: selectedRegion !== 'all' },
							]"
						>
							<label for="region-filter">Region</label>
							<select id="region-filter" v-model="selectedRegion">
								<option
									v-for="option in regionOptions"
									:key="option"
									:value="option"
								>
									{{ option === "all" ? "All regions" : option }}
								</option>
							</select>
						</div>

						<div
							:class="[
								'filter-card',
								'field',
								{ active: selectedBuildYear !== 'all' },
							]"
						>
							<label for="build-year-filter">Build year</label>
							<select id="build-year-filter" v-model="selectedBuildYear">
								<option
									v-for="option in buildYearOptions"
									:key="option"
									:value="option"
								>
									{{ option === "all" ? "All years" : option }}
								</option>
							</select>
						</div>

						<div
							:class="[
								'filter-card',
								'field',
								{ active: selectedBuildMonth !== 'all' },
							]"
						>
							<label for="build-month-filter">Build month</label>
							<select id="build-month-filter" v-model="selectedBuildMonth">
								<option
									v-for="option in buildMonthOptions"
									:key="option"
									:value="option"
								>
									{{ option === "all" ? "All months" : option }}
								</option>
							</select>
						</div>

						<div
							:class="[
								'filter-card',
								'field',
								{ active: selectedRecall !== 'all' },
							]"
						>
							<label for="recall-filter">Recall 41D033</label>
							<select id="recall-filter" v-model="selectedRecall">
								<option value="all">All statuses</option>
								<option value="yes">Yes</option>
								<option value="no">No</option>
								<option value="unknown">Unknown</option>
							</select>
						</div>
					</div>
				</div>

				<!-- Stats -->
				<div class="stat-grid" style="margin-top: 24px; margin-bottom: 24px">
					<div class="stat-card">
						<span>Incidents in view</span>
						<strong>{{ filteredStats.incidents }}</strong>
						<small
							v-if="filteredStats.incidents !== filteredStats.total"
							class="stat-sub"
						>
							of {{ filteredStats.total }} total
						</small>
					</div>
					<div class="stat-card">
						<span>Avg km at reported incident</span>
						<strong>{{
							filteredStats.averageKm?.toLocaleString() ?? "n/a"
						}}</strong>
						<small v-if="filteredStats.kmReported > 0" class="stat-sub">
							{{ filteredStats.kmReported }} with km data
						</small>
					</div>
					<div class="stat-card">
						<span>Possible repeat incidents</span>
						<strong>{{ filteredStats.repeatCount }}</strong>
						<small class="stat-sub"
							>{{ filteredStats.repeatPct }}% of selection</small
						>
					</div>
					<div class="stat-card">
						<span>After recall 41D033</span>
						<strong>{{ filteredStats.afterRecallCount }}</strong>
						<small class="stat-sub"
							>{{ filteredStats.afterRecallPct }}% of selection</small
						>
					</div>
				</div>

				<!-- Interactive charts -->
				<div v-if="filteredIncidents.length > 0">
					<ClientOnly>
						<AsyncAnalyticsCharts :incidents="filteredIncidents" />
					</ClientOnly>
				</div>
				<div v-else class="empty-state">
					<h3>No incidents match the current filters</h3>
					<p>
						Try removing one or more filters to return to the full dataset.
					</p>
					<button class="ghost-button" type="button" @click="resetFilters">
						Reset filters
					</button>
				</div>
			</section>

			<!-- ═══ Incident table ═══ -->
			<section id="data-table" class="section">
				<div class="section-head">
					<h2>Incident table</h2>
					<p>
						All published reports, filtered by your current selection. Click
						column headers to sort, use column menus to filter. Only anonymized,
						normalized fields are included.
					</p>
				</div>

				<div v-if="filteredIncidents.length > 0">
					<ClientOnly>
						<AsyncIncidentGrid :rowData="filteredIncidents" />
					</ClientOnly>
				</div>
				<div v-else class="empty-state empty-state-compact">
					<h3>No rows to show</h3>
					<p>
						The current filter combination excludes every published incident.
					</p>
				</div>

				<p class="footer-note">
					Only reports marked for publication in the sheet are shown here. So far,
					{{ directSubmissionShare }} of published reports were submitted directly
					through this site.
				</p>

				<div class="sources-block">
					<h3>Sources</h3>
					<div class="source-link-grid">
						<a
							class="source-link-card"
							href="https://www.goingelectric.de/forum/viewtopic.php?f=531&t=91515"
							target="_blank"
							rel="noreferrer"
						>
							<strong>GoingElectric</strong>
							<span>Forum thread tracking ICCU-related reports and discussion.</span>
						</a>

						<a
							class="source-link-card"
							href="https://www.reddit.com/r/Ioniq5/"
							target="_blank"
							rel="noreferrer"
						>
							<strong>r/Ioniq5</strong>
							<span>Community discussion and owner reports for Ioniq 5.</span>
						</a>

						<a
							class="source-link-card"
							href="https://www.reddit.com/r/electricvehicles"
							target="_blank"
							rel="noreferrer"
						>
							<strong>r/electricvehicles</strong>
							<span>Broader EV discussion and incident references.</span>
						</a>
					</div>
				</div>
			</section>

			<!-- ═══ How to contribute ═══ -->
			<section id="how-to-contribute" class="section contribute-section">
				<div class="section-head">
					<h2>How to contribute</h2>
					<p>
						Start with the report form. Submit the incident details once, and the
						moderation workflow handles the rest before publication.
					</p>
				</div>

				<div class="contribute-grid">
					<div class="section-card contribute-flow-card">
						<div class="contribute-flow-head">
							<p class="section-kicker">Submission flow</p>
							<h3>Send the incident details, then we clean them up</h3>
							<p>
								The form stays short. Submit the vehicle and incident details
								once, and the moderation process takes care of the rest.
							</p>
						</div>

						<div class="steps-list">
							<div class="step-item">
								<div class="step-number">1</div>
								<div class="step-content">
									<h3>Fill out the short form</h3>
									<p>
										Click "Report a suspected ICCU incident" and fill in the Google
										Form. You'll be asked for the vehicle model, region,
										approximate build date, odometer reading at the time of
										the reported incident, and whether the 41D033 recall was
										done beforehand.
									</p>
								</div>
							</div>

							<div class="step-item">
								<div class="step-number">2</div>
								<div class="step-content">
									<h3>We review and normalize</h3>
									<p>
										Submissions land in a private moderation sheet. We verify
										plausibility, normalize model names and dates, and flag
										duplicates. Approval means the report is suitable for the
										public dataset, not that the underlying theory has been
										technically proven.
									</p>
								</div>
							</div>

							<div class="step-item">
								<div class="step-number">3</div>
								<div class="step-content">
									<h3>It appears on this page</h3>
									<p>
										When the site rebuilds, the public CSV export is converted
										to a JSON snapshot and the analytics update automatically.
										Your report becomes part of the live charts and downloadable
										dataset.
									</p>
								</div>
							</div>
						</div>

						<div style="margin-top: 24px">
							<a
								v-if="runtimeConfig.public.googleFormUrl"
								class="cta"
								:href="runtimeConfig.public.googleFormUrl"
								target="_blank"
								rel="noreferrer"
							>
								Report a suspected ICCU incident
							</a>
						</div>
					</div>

				</div>

				<div class="section-card github-contribute-card">
					<div class="contribute-flow-head">
						<p class="section-kicker">Contribute on GitHub</p>
						<h3>Help improve the tracker, data pipeline, and documentation</h3>
						<p>
							This project is open source. Use the repository links below to
							report issues, propose documentation improvements, or send patches.
						</p>
					</div>

					<div v-if="githubRepoPath" class="github-link-grid">
						<a
							class="github-link-card"
							:href="githubRepoUrl"
							target="_blank"
							rel="noreferrer"
						>
							<strong>Open the repository</strong>
							<span>Main project page, setup notes, and release history.</span>
						</a>

						<a
							class="github-link-card"
							:href="githubIssuesUrl"
							target="_blank"
							rel="noreferrer"
						>
							<strong>Report bugs or suggest improvements</strong>
							<span>Issues for bugs, tracker ideas, and data quality feedback.</span>
						</a>

						<a
							class="github-link-card"
							:href="githubPullsUrl"
							target="_blank"
							rel="noreferrer"
						>
							<strong>Submit a pull request</strong>
							<span>Code, copy, data tooling, and documentation contributions.</span>
						</a>
					</div>
					<p v-else class="mini-note">
						Set <code>GH_REPO_URL</code> to enable repository, issues, and pull
						request links on the published site.
					</p>
				</div>
			</section>

			<section class="section">
				<div class="section-head">
					<h2>Privacy and data handling</h2>
					<p>
						The tracker is designed to publish useful incident patterns without
						publishing personally identifying information.
					</p>
				</div>

				<div class="policy-grid">
					<div class="section-card policy-card">
						<h3>What is stored privately</h3>
						<p>
							Raw submissions enter a moderation sheet first. That working copy
							may include enough detail to validate the report, detect duplicates,
							and standardize dates, regions, and model names before publication.
						</p>
					</div>
					<div class="section-card policy-card">
						<h3>What is published publicly</h3>
						<p>
							The public dataset only exposes normalized, anonymized fields used
							for analysis. Names, email addresses, screenshots, raw submission
							IDs, and other direct identifiers are not published. Moderated
							public comments may be published when maintainers decide they are
							safe to expose. The public table and exports are limited to
							non-identifying fields needed for analysis.
						</p>
					</div>
					<div class="section-card policy-card">
						<h3>Corrections and removal</h3>
						<p>
							If a published row needs a correction or should be removed, open an
							issue in the project repository or contact the maintainers through
							the submission workflow so the moderation sheet can be updated before
							the next snapshot.
						</p>
						<div v-if="githubRepoPath" class="policy-actions">
							<a
								class="ghost-button cta-sm"
								:href="githubIssuesUrl"
								target="_blank"
								rel="noreferrer"
							>
								Request a correction
							</a>
						</div>
					</div>
				</div>
			</section>

			<section class="section">
				<div class="section-head">
					<h2>Methodology and dataset notes</h2>
					<p>
						This page should be treated as a descriptive incident tracker, not a
						failure-rate study or proof of causation.
					</p>
				</div>

				<div class="policy-grid">
					<div class="section-card policy-card">
						<h3>Publication criteria</h3>
						<p>
							Rows are published only after moderation. The review checks whether
							the report is coherent enough to normalize and whether it belongs in
							the public ICCU incident dataset.
						</p>
					</div>
					<div class="section-card policy-card">
						<h3>Normalization and deduping</h3>
						<p>
							Model labels, recall status, build dates, and reported failure dates
							are normalized into a common format. Repeat incidents are flagged so
							the same vehicle can be studied without counting every report as an
							entirely unrelated case.
						</p>
					</div>
					<div class="section-card policy-card">
						<h3>Field definitions</h3>
						<p>
							The published view focuses on model, region, build date, odometer at
							failure, failure date precision, recall status, repeat-incident
							flagging, moderated public comments, and coarse VIN sequence
							buckets. Missing or uncertain values are shown as
							<strong>unknown</strong> rather than guessed.
						</p>
					</div>
				</div>

				<div class="section-card methodology-card">
					<div class="methodology-head">
						<div>
							<p class="section-kicker">Open data</p>
							<h3>Download the current moderated snapshot</h3>
							<p>
								Use the full snapshot if you want to audit the current public data
								without applying page filters first.
							</p>
						</div>
						<div class="hero-actions methodology-actions">
							<button class="cta" type="button" @click="downloadSnapshotCsv">
								Download snapshot CSV
							</button>
							<button class="cta" type="button" @click="downloadSnapshotJson">
								Download snapshot JSON
							</button>
						</div>
					</div>
				</div>
			</section>

			<!-- ═══ Footer ═══ -->
			<footer class="site-footer">
				<p class="footer-disclaimer">
					This site is not affiliated with, endorsed by, or sponsored by Hyundai
					Motor Group, Kia Corporation, or any of their subsidiaries. All
					product names, logos, and brands are property of their respective
					owners and are used here for identification purposes only. References
					to suspected ICCU-related issues reflect community reports and working
					hypotheses, not established findings of fault or causation.
				</p>
				<p class="footer-disclaimer">
					Takedown or copyright concerns:
					<a href="mailto:iccu-tracker-account@proton.me">
						iccu-tracker-account@proton.me
					</a>
				</p>
				<div class="footer-meta">
					<span>Snapshot: {{ snapshot.meta.generatedAt.slice(0, 10) }}</span>
					<span>·</span>
					<span>Source: {{ snapshot.meta.source.type }}</span>
					<span>·</span>
					<span>{{ snapshot.meta.publishedRows }} published rows</span>
					<span>·</span>
					<span>Open data — download CSV or JSON above</span>
				</div>
			</footer>
		</main>
	</div>
</template>
