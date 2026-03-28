<script setup lang="ts">
import { computed } from "vue";
import { Bar, Doughnut, Line } from "vue-chartjs";
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale,
  ArcElement,
  PointElement,
  LineElement,
  Filler,
} from "chart.js";

ChartJS.register(
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale,
  ArcElement,
  PointElement,
  LineElement,
  Filler
);

type Incident = {
  model: string;
  region: string;
  buildYear: number | null;
  buildMonth: number | null;
  buildCohort: string;
  odometerKmAtFailure: number | null;
  failureDate: string | null;
  failureDatePrecision: string;
  failureYear: number | null;
  failureMonth: number | null;
  recall41d033Done: string;
  incidentSequence: number;
  publicComment: string;
  isRepeatFailure: boolean;
  kmBucket: string;
  ageBucket: string;
};

const props = defineProps<{
  incidents: Incident[];
}>();

// ── Color palette ────────────────────────────────────────
const palette = [
  "rgba(56, 189, 248, 0.85)",  // sky blue
  "rgba(99, 102, 241, 0.85)",  // indigo
  "rgba(168, 85, 247, 0.85)",  // purple
  "rgba(245, 158, 11, 0.85)",  // amber
  "rgba(239, 68, 68, 0.85)",   // red
  "rgba(34, 197, 94, 0.85)",   // green
  "rgba(236, 72, 153, 0.85)",  // pink
  "rgba(20, 184, 166, 0.85)",  // teal
];

const paletteBorder = palette.map((c) => c.replace("0.85)", "1)"));

function countBy<T extends string>(
  items: Incident[],
  selector: (item: Incident) => T
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = selector(item) || "unknown";
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

// ── Shared chart options ─────────────────────────────────
const chartFont = {
  family: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
};

const darkTooltip = {
  backgroundColor: "rgba(22, 24, 34, 0.95)",
  titleColor: "#f1f3f9",
  bodyColor: "#e8eaf0",
  borderColor: "rgba(255, 255, 255, 0.1)",
  borderWidth: 1,
  cornerRadius: 10,
  padding: 12,
  titleFont: { ...chartFont, weight: "bold" as const },
  bodyFont: chartFont,
};

const darkLegend = {
  labels: {
    color: "#8b8fa7",
    font: { ...chartFont, size: 12 },
    padding: 16,
    usePointStyle: true,
    pointStyleWidth: 10,
  },
};

const darkScales = {
  x: {
    ticks: { color: "#8b8fa7", font: { ...chartFont, size: 11 } },
    grid: { color: "rgba(255, 255, 255, 0.05)" },
    border: { color: "rgba(255, 255, 255, 0.08)" },
  },
  y: {
    ticks: { color: "#8b8fa7", font: { ...chartFont, size: 11 } },
    grid: { color: "rgba(255, 255, 255, 0.05)" },
    border: { color: "rgba(255, 255, 255, 0.08)" },
  },
};

// ── 1. Failures by Model (Doughnut) ─────────────────────
const modelChartData = computed(() => {
  const counts = countBy(props.incidents, (i) => i.model);
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return {
    labels: sorted.map(([l]) => l),
    datasets: [
      {
        data: sorted.map(([, c]) => c),
        backgroundColor: palette.slice(0, sorted.length),
        borderColor: paletteBorder.slice(0, sorted.length),
        borderWidth: 1,
        hoverOffset: 8,
      },
    ],
  };
});

const doughnutOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { ...darkLegend, position: "bottom" as const },
    tooltip: darkTooltip,
    title: {
      display: true,
      text: "Failures by Model",
      color: "#8b8fa7",
      font: { ...chartFont, size: 13, weight: "bold" as const },
      padding: { bottom: 16 },
    },
  },
  cutout: "55%",
}));

// ── 2. Km Distribution (Bar) ────────────────────────────
const kmOrder = [
  "0-9,999",
  "10,000-19,999",
  "20,000-29,999",
  "30,000-39,999",
  "40,000-49,999",
  "50,000-59,999",
  "60,000-79,999",
  "80,000+",
  "unknown",
];

const kmChartData = computed(() => {
  const counts = countBy(props.incidents, (i) => i.kmBucket);
  const labels = kmOrder.filter((k) => counts.has(k));
  return {
    labels,
    datasets: [
      {
        label: "Incidents",
        data: labels.map((k) => counts.get(k) || 0),
        backgroundColor: "rgba(56, 189, 248, 0.6)",
        borderColor: "rgba(56, 189, 248, 1)",
        borderWidth: 1,
        borderRadius: 6,
        hoverBackgroundColor: "rgba(56, 189, 248, 0.85)",
      },
    ],
  };
});

const barOptions = (title: string) => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: darkTooltip,
    title: {
      display: true,
      text: title,
      color: "#8b8fa7",
      font: { ...chartFont, size: 13, weight: "bold" as const },
      padding: { bottom: 16 },
    },
  },
  scales: darkScales,
});

const kmOptions = computed(() => barOptions("Kilometer at Failure"));

// ── 3. Vehicle Age (Bar) ────────────────────────────────
const ageOrder = ["<1 year", "1 year", "2 years", "3 years", "4+ years", "unknown"];

const ageChartData = computed(() => {
  const counts = countBy(props.incidents, (i) => i.ageBucket);
  const labels = ageOrder.filter((k) => counts.has(k));
  return {
    labels,
    datasets: [
      {
        label: "Incidents",
        data: labels.map((k) => counts.get(k) || 0),
        backgroundColor: "rgba(99, 102, 241, 0.6)",
        borderColor: "rgba(99, 102, 241, 1)",
        borderWidth: 1,
        borderRadius: 6,
        hoverBackgroundColor: "rgba(99, 102, 241, 0.85)",
      },
    ],
  };
});

const ageOptions = computed(() => barOptions("Vehicle Age at Failure"));

// ── 5. Failures Over Time (Line) ────────────────────────
const timelineChartData = computed(() => {
  const monthCounts = new Map<string, number>();
  for (const i of props.incidents) {
    if (i.failureYear && i.failureMonth) {
      const key = `${i.failureYear}-${String(i.failureMonth).padStart(2, "0")}`;
      monthCounts.set(key, (monthCounts.get(key) || 0) + 1);
    }
  }
  const sorted = [...monthCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  return {
    labels: sorted.map(([l]) => l),
    datasets: [
      {
        label: "Failures",
        data: sorted.map(([, c]) => c),
        borderColor: "rgba(245, 158, 11, 1)",
        backgroundColor: "rgba(245, 158, 11, 0.15)",
        pointBackgroundColor: "rgba(245, 158, 11, 1)",
        pointBorderColor: "#161822",
        pointRadius: 4,
        pointHoverRadius: 7,
        borderWidth: 2,
        tension: 0.3,
        fill: true,
      },
    ],
  };
});

const timelineOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: darkTooltip,
    title: {
      display: true,
      text: "Failures Over Time",
      color: "#8b8fa7",
      font: { ...chartFont, size: 13, weight: "bold" as const },
      padding: { bottom: 16 },
    },
  },
  scales: darkScales,
}));

// ── 6. Recall Status (Doughnut) ─────────────────────────
const recallChartData = computed(() => {
  const counts = countBy(props.incidents, (i) => i.recall41d033Done);
  const order = ["yes", "no", "unknown"];
  const labels = order.filter((k) => counts.has(k));
  const colorMap: Record<string, string> = {
    yes: "rgba(34, 197, 94, 0.85)",
    no: "rgba(239, 68, 68, 0.85)",
    unknown: "rgba(139, 143, 167, 0.6)",
  };
  const borderMap: Record<string, string> = {
    yes: "rgba(34, 197, 94, 1)",
    no: "rgba(239, 68, 68, 1)",
    unknown: "rgba(139, 143, 167, 1)",
  };
  return {
    labels: labels.map((l) =>
      l === "yes" ? "After recall" : l === "no" ? "Before recall" : "Unknown"
    ),
    datasets: [
      {
        data: labels.map((k) => counts.get(k) || 0),
        backgroundColor: labels.map((k) => colorMap[k]),
        borderColor: labels.map((k) => borderMap[k]),
        borderWidth: 1,
        hoverOffset: 8,
      },
    ],
  };
});

const recallOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { ...darkLegend, position: "bottom" as const },
    tooltip: darkTooltip,
    title: {
      display: true,
      text: "Recall 41D033 Status",
      color: "#8b8fa7",
      font: { ...chartFont, size: 13, weight: "bold" as const },
      padding: { bottom: 16 },
    },
  },
  cutout: "55%",
}));

const hasTimelineData = computed(
  () => timelineChartData.value.labels.length > 0
);
</script>

<template>
  <div class="charts-grid">
    <div class="chart-panel doughnut-panel">
      <Doughnut :data="modelChartData" :options="doughnutOptions" />
    </div>

    <div class="chart-panel doughnut-panel">
      <Doughnut :data="recallChartData" :options="recallOptions" />
    </div>

    <div class="chart-panel bar-panel">
      <Bar :data="kmChartData" :options="kmOptions" />
    </div>

    <div class="chart-panel bar-panel">
      <Bar :data="ageChartData" :options="ageOptions" />
    </div>

    <div class="chart-panel line-panel" v-if="hasTimelineData">
      <Line :data="timelineChartData" :options="timelineOptions" />
    </div>
  </div>
</template>

<style scoped>
.charts-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.chart-panel {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 20px;
  position: relative;
  transition: all var(--transition);
}

.chart-panel:hover {
  background: var(--surface-hover);
  box-shadow: var(--shadow);
}

.doughnut-panel {
  height: 340px;
}

.bar-panel {
  height: 320px;
}

.line-panel {
  grid-column: 1 / -1;
  height: 340px;
}

@media (max-width: 768px) {
  .charts-grid {
    grid-template-columns: 1fr;
  }

  .doughnut-panel {
    height: 300px;
  }

  .bar-panel {
    height: 280px;
  }

  .line-panel {
    height: 300px;
  }
}
</style>
