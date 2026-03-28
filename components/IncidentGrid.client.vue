<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { AgGridVue } from "ag-grid-vue3";
import { ModuleRegistry, AllCommunityModule, themeMaterial, colorSchemeDarkBlue } from "ag-grid-community";

ModuleRegistry.registerModules([AllCommunityModule]);

const gridTheme = themeMaterial
  .withPart(colorSchemeDarkBlue)
  .withParams({
    backgroundColor: "#0f1117",
    foregroundColor: "#e8eaf0",
    headerTextColor: "#ffffff",
    headerBackgroundColor: "rgba(255, 255, 255, 0.04)",
    borderColor: "rgba(255, 255, 255, 0.08)",
    rowHoverColor: "rgba(255, 255, 255, 0.06)",
    selectedRowBackgroundColor: "rgba(56, 189, 248, 0.08)",
    accentColor: "#38bdf8",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontSize: 14,
    headerFontWeight: 600,
    oddRowBackgroundColor: "rgba(255, 255, 255, 0.02)",
    borderRadius: 0,
  });

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
  rowData: Incident[];
}>();

const emit = defineEmits<{
  (e: "exportCsv"): void;
  (e: "exportJson"): void;
}>();

const gridApi = ref<any>(null);

function formatBuildLabel(params: any) {
  const { buildYear, buildMonth } = params.data;
  if (buildYear && buildMonth) {
    return `${buildYear}-${String(buildMonth).padStart(2, "0")}`;
  }
  if (buildYear) return String(buildYear);
  if (buildMonth) return `Month ${String(buildMonth).padStart(2, "0")}`;
  return "Unknown";
}

function formatFailureLabel(params: any) {
  const incident = params.data;
  if (!incident.failureYear && !incident.failureMonth) return "Unknown";
  if (incident.failureDatePrecision === "day_exact" && incident.failureDate) {
    return incident.failureDate;
  }
  if (incident.failureYear && incident.failureMonth) {
    return `${String(incident.failureMonth).padStart(2, "0")}/${incident.failureYear}`;
  }
  return String(incident.failureYear || "Unknown");
}

function formatKm(params: any) {
  const value = params.value;
  if (value == null) return "—";
  return value.toLocaleString();
}


const columnDefs = ref([
  {
    headerName: "Vehicle Model",
    field: "model",
    filter: true,
    minWidth: 120,
    flex: 1,
  },
  {
    headerName: "Region",
    field: "region",
    filter: true,
    minWidth: 110,
    flex: 0.9,
  },
  {
    headerName: "Build Date",
    valueGetter: (params: any) => {
      const { buildYear, buildMonth } = params.data;
      return (buildYear ?? 0) * 100 + (buildMonth ?? 0);
    },
    valueFormatter: formatBuildLabel,
    filter: "agNumberColumnFilter",
    minWidth: 110,
    flex: 1,
  },
  {
    headerName: "ODO",
    field: "odometerKmAtFailure",
    valueFormatter: formatKm,
    filter: "agNumberColumnFilter",
    minWidth: 100,
    flex: 1,
  },
  {
    headerName: "Failure Date",
    valueGetter: (params: any) => {
      const { failureYear, failureMonth } = params.data;
      return (failureYear ?? 0) * 100 + (failureMonth ?? 0);
    },
    valueFormatter: formatFailureLabel,
    filter: "agNumberColumnFilter",
    minWidth: 110,
    flex: 1,
  },
  {
    headerName: "Recall 41D033 Done?",
    field: "recall41d033Done",
    filter: true,
    minWidth: 100,
    flex: 0.8,
  },
  {
    headerName: "ICCU Count",
    field: "incidentSequence",
    filter: "agNumberColumnFilter",
    minWidth: 85,
    flex: 0.6,
  },
  {
    headerName: "Public Comment",
    field: "publicComment",
    filter: true,
    minWidth: 220,
    flex: 2,
    sortable: false,
    valueFormatter: (params: any) => params.value || "—",
  },
]);

const defaultColDef = ref({
  sortable: true,
  resizable: true,
});

const paginationPageSize = ref(25);
const paginationPageSizeSelector = ref([25, 50, 100]);

function onGridReady(params: any) {
  gridApi.value = params.api;
}

function exportCsv() {
  if (gridApi.value) {
    gridApi.value.exportDataAsCsv({
      fileName: "iccu-filtered-data.csv",
    });
  }
}

function downloadBlob(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function exportJson() {
  const rows: any[] = [];
  if (gridApi.value) {
    gridApi.value.forEachNodeAfterFilterAndSort((node: any) => {
      rows.push(node.data);
    });
  }
  if (rows.length === 0) return;
  downloadBlob(
    "iccu-filtered-data.json",
    `${JSON.stringify(rows, null, 2)}\n`,
    "application/json;charset=utf-8"
  );
}

const rowCount = computed(() => props.rowData.length);
</script>

<template>
  <div class="grid-container">
    <div class="table-toolbar">
      <span class="table-count">{{ rowCount }} incidents</span>
      <div class="table-toolbar-actions">
        <button
          class="ghost-button cta-sm"
          type="button"
          :disabled="rowCount === 0"
          @click="exportCsv"
        >
          ↓ CSV
        </button>
        <button
          class="ghost-button cta-sm"
          type="button"
          :disabled="rowCount === 0"
          @click="exportJson"
        >
          ↓ JSON
        </button>
      </div>
    </div>

    <div class="grid-wrapper">
      <AgGridVue
        style="width: 100%; height: 100%"
        :theme="gridTheme"
        :rowData="rowData"
        :columnDefs="columnDefs"
        :defaultColDef="defaultColDef"
        :pagination="true"
        :paginationPageSize="paginationPageSize"
        :paginationPageSizeSelector="paginationPageSizeSelector"
        :animateRows="true"
        :suppressCellFocus="true"
        rowSelection="single"
        @grid-ready="onGridReady"
      />
    </div>
  </div>
</template>

<style scoped>
.grid-container {
  border-radius: var(--radius);
  border: 1px solid var(--line);
  overflow: hidden;
}

.grid-wrapper {
  height: 620px;
  --ag-header-foreground-color: #ffffff;
}

@media (max-width: 768px) {
  .grid-wrapper {
    height: 480px;
  }
}

@media (max-width: 480px) {
  .grid-wrapper {
    height: 420px;
  }
}
</style>
