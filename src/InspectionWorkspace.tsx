import { useEffect, useMemo, useState } from "react";
import type { AuthUser } from "../shared/contracts";
import { api } from "./api";

type WorkflowResource = "inspections" | "quality-checks";
type WorkflowRecord = Record<string, unknown>;
type StatusFilter = "all" | "pending" | "inspecting" | "completed" | "in_correction";

export interface WorkflowSelection {
  resource: WorkflowResource;
  record: WorkflowRecord;
}

function recordText(record: WorkflowRecord, key: string, fallback = "—"): string {
  const value = record[key];
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function dateText(value: unknown): string {
  if (!value) return "—";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function statusStyle(status: string): string {
  if (["completed", "approved"].includes(status))
    return "bg-emerald-100 text-emerald-800";
  if (["pending", "inspecting"].includes(status))
    return "bg-amber-100 text-amber-800";
  if (status === "in_correction") return "bg-rose-100 text-rose-800";
  return "bg-slate-100 text-slate-700";
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-md px-2 py-1 text-[11px] font-semibold capitalize ${statusStyle(status)}`}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}

function WorkspaceHeading({
  eyebrow,
  title,
  description,
  count,
  onRefresh,
}: {
  eyebrow: string;
  title: string;
  description: string;
  count: number;
  onRefresh: () => void;
}) {
  return (
    <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="mb-1 text-xs font-bold uppercase tracking-[.16em] text-brand">
          {eyebrow}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">
          {title}
          <span className="ml-2 align-middle text-sm font-medium text-muted">
            {count}
          </span>
        </h1>
        <p className="mt-1.5 text-sm text-muted">{description}</p>
      </div>
      <button className="btn-secondary self-start sm:self-auto" onClick={onRefresh}>
        ↻ Refresh
      </button>
    </div>
  );
}

function useRecords(resource: WorkflowResource) {
  const [records, setRecords] = useState<WorkflowRecord[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    let active = true;
    void api
      .list(resource, {
        page: 1,
        pageSize: 100,
        sort: "created_at",
        direction: "desc",
      })
      .then((result) => {
        if (active) {
          setRecords(result.data);
          setError("");
        }
      })
      .catch((failure: unknown) => {
        if (active)
          setError(
            failure instanceof Error ? failure.message : "Unable to load records.",
          );
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [resource, refreshKey]);
  return {
    records,
    busy,
    error,
    refresh: () => {
      setBusy(true);
      setRefreshKey((key) => key + 1);
    },
  };
}

function useVehicleRecords(user: AuthUser) {
  const [listings, setListings] = useState<WorkflowRecord[]>([]);
  const [quickListings, setQuickListings] = useState<WorkflowRecord[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    if (user.role === "inspector") return;
    let active = true;
    void Promise.all([
      api.list("listings", { page: 1, pageSize: 100 }),
      api.list("quick-listings", { page: 1, pageSize: 100 }),
    ])
      .then(([listingResult, quickListingResult]) => {
        if (active) {
          setListings(listingResult.data);
          setQuickListings(quickListingResult.data);
          setError("");
        }
      })
      .catch((failure: unknown) => {
        if (active)
          setError(
            failure instanceof Error
              ? `Vehicle details could not be loaded: ${failure.message}`
              : "Vehicle details could not be loaded.",
          );
      });
    return () => {
      active = false;
    };
  }, [user.role]);
  return { listings, quickListings, error };
}

function FilterTabs({
  records,
  selected,
  onSelect,
  quality = false,
}: {
  records: WorkflowRecord[];
  selected: StatusFilter;
  onSelect: (status: StatusFilter) => void;
  quality?: boolean;
}) {
  const tabs: { key: StatusFilter; label: string }[] = quality
    ? [
        { key: "pending", label: "Pending" },
        { key: "completed", label: "Completed" },
        { key: "in_correction", label: "In Correction" },
      ]
    : [
        { key: "all", label: "All Leads" },
        { key: "pending", label: "Pending" },
        { key: "inspecting", label: "Inspecting" },
        { key: "completed", label: "Completed" },
      ];
  return (
    <div className="flex flex-wrap border-b border-slate-200">
      {tabs.map((tab) => {
        const count = records.filter((record) =>
          tab.key === "all" ? true : record.status === tab.key,
        ).length;
        return (
          <button
            key={tab.key}
            aria-pressed={selected === tab.key}
            onClick={() => onSelect(tab.key)}
            className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition ${
              selected === tab.key
                ? "border-brand text-brand"
                : "border-transparent text-slate-500 hover:text-ink"
            }`}
          >
            {tab.label}
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                selected === tab.key
                  ? "bg-brand-soft text-brand"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function InspectionWorkspace({
  resource,
  user,
  onInspect,
}: {
  resource: WorkflowResource;
  user: AuthUser;
  onInspect: (selection: WorkflowSelection) => void;
}) {
  const { records, busy, error, refresh } = useRecords(resource);
  const {
    listings,
    quickListings,
    error: vehicleError,
  } = useVehicleRecords(user);
  const [filter, setFilter] = useState<StatusFilter>(
    resource === "quality-checks" ? "pending" : "all",
  );
  const [search, setSearch] = useState("");
  const quality = resource === "quality-checks";
  const enrichedRecords = useMemo(
    () =>
      records.map((record) => {
        const listing = listings.find(
          (item) => String(item.id) === String(record.listing_id),
        );
        const quickListing = quickListings.find(
          (item) =>
            String(item.id) === String(record.quick_listing_id) ||
            String(item.ref_id) === String(record.ref_id),
        );
        return { ...listing, ...quickListing, ...record };
      }),
    [records, listings, quickListings],
  );
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return enrichedRecords.filter((record) => {
      const status = String(record.status ?? "");
      const matchesStatus =
        filter === "all" || status === filter;
      const searchable = [
        record.registration_no,
        record.ref_id,
        record.customer_name,
        record.mobile,
        record.address,
        record.brand,
        record.model,
        record.variant,
        record.assigned_to_name,
      ]
        .map((value) => String(value ?? "").toLowerCase())
        .join(" ");
      return matchesStatus && (!term || searchable.includes(term));
    });
  }, [enrichedRecords, filter, search]);
  const title = quality ? "Quality Checks" : "Inspection Leads";

  return (
    <>
      <WorkspaceHeading
        eyebrow="Operations"
        title={title}
        description={
          quality
            ? "Review vehicle inspections and complete the quality check."
            : "Review assigned vehicle leads and manage inspection progress."
        }
        count={records.length}
        onRefresh={refresh}
      />
      {(error || vehicleError) && (
        <div
          role="alert"
          className="mb-4 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
        >
          <span>{error || vehicleError}</span>
          {error && (
            <button className="font-semibold underline" onClick={refresh}>
              Retry
            </button>
          )}
        </div>
      )}
      <section className="card overflow-hidden">
        <FilterTabs
          records={enrichedRecords}
          selected={filter}
          onSelect={setFilter}
          quality={quality}
        />
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted">
            {busy
              ? "Loading records…"
              : `Showing ${visible.length} ${quality ? "quality checks" : "leads"}`}
          </p>
          <label className="sr-only" htmlFor="inspection-search">
            Search by registration, reference, customer, or mobile
          </label>
          <input
            id="inspection-search"
            className="field-control max-w-sm py-2"
            type="search"
            placeholder="Search registration, ref ID, customer, mobile…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        {quality ? (
          <QualityTable
            records={visible}
            busy={busy}
            user={user}
            onInspect={(record) =>
              onInspect({ resource: "quality-checks", record })
            }
          />
        ) : (
          <InspectionCards
            records={visible}
            busy={busy}
            onInspect={(record) => onInspect({ resource: "inspections", record })}
          />
        )}
      </section>
    </>
  );
}

function InspectionCards({
  records,
  busy,
  onInspect,
}: {
  records: WorkflowRecord[];
  busy: boolean;
  onInspect: (record: WorkflowRecord) => void;
}) {
  if (busy)
    return (
      <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3" role="status">
        {[1, 2, 3].map((item) => (
          <div key={item} className="h-64 animate-pulse rounded-xl bg-slate-100" />
        ))}
      </div>
    );
  if (!records.length)
    return (
      <div className="px-6 py-16 text-center text-sm text-muted">
        No inspections match these filters.
      </div>
    );
  return (
    <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
      {records.map((record) => {
        const status = String(record.status ?? "pending");
        const name = recordText(record, "customer_name", "Vehicle customer");
        const mobile = recordText(record, "mobile", "");
        const vehicle = [
          record.brand,
          record.model,
          record.variant,
        ]
          .filter(Boolean)
          .map(String)
          .join(" ");
        return (
          <article
            key={String(record.id)}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="flex items-center justify-between gap-2 bg-brand-navy px-4 py-3 text-white">
              <p className="truncate text-xs font-bold">
                {recordText(record, "ref_id", recordText(record, "registration_no"))}
              </p>
              <StatusBadge status={status} />
            </div>
            <div className="space-y-2.5 p-4">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-bold uppercase text-brand">
                  {name.slice(0, 1)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{name}</p>
                  {mobile && (
                    <a
                      className="text-xs text-muted hover:text-brand"
                      href={`tel:${mobile}`}
                    >
                      ☎ {mobile}
                    </a>
                  )}
                </div>
              </div>
              <InfoRow
                label="Vehicle"
                value={
                  vehicle
                    ? `${vehicle} · ${recordText(record, "registration_no")}`
                    : recordText(record, "registration_no")
                }
              />
              <InfoRow
                label="Appointment"
                value={dateText(record.scheduled_at ?? record.appointment_at)}
              />
              <div className="rounded-lg border-l-2 border-brand bg-brand-soft p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-brand">
                  Location
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  {recordText(record, "address", recordText(record, "notes", "Location not provided"))}
                </p>
                {Boolean(record.city) && (
                  <p className="mt-1 text-xs text-slate-500">
                    {recordText(record, "city")}
                    {record.state ? `, ${recordText(record, "state")}` : ""}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                {mobile ? (
                  <a
                    className="inline-flex items-center justify-center rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700"
                    href={`tel:${mobile}`}
                  >
                    ☎ Call
                  </a>
                ) : (
                  <span className="rounded-lg bg-slate-100 px-3 py-2 text-center text-xs text-slate-500">
                    No phone
                  </span>
                )}
                <button
                  className={`rounded-lg px-3 py-2 text-xs font-semibold text-white ${
                    status === "pending" ? "bg-brand hover:bg-brand-dark" : "bg-brand-navy hover:bg-slate-800"
                  }`}
                  onClick={() => onInspect(record)}
                >
                  {status === "pending" ? "Start inspection" : "Update"}
                </button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-md bg-slate-100 px-2.5 py-2 text-xs">
      <span className="w-20 shrink-0 text-slate-500">{label}</span>
      <span className="truncate font-medium text-slate-700">{value}</span>
    </div>
  );
}

function QualityTable({
  records,
  busy,
  user,
  onInspect,
}: {
  records: WorkflowRecord[];
  busy: boolean;
  user: AuthUser;
  onInspect: (record: WorkflowRecord) => void;
}) {
  const columns = [
    "#",
    "Reg. No",
    "Ref ID",
    "Assigned On",
    "Name",
    "Mobile",
    "Address",
    "Brand",
    "Model",
    "Variant",
    "Inspected By",
    "Status",
    "Actions",
  ];
  return (
    <div className="scrollbar-thin overflow-x-auto">
      <table className="w-full min-w-[1250px] border-collapse text-left text-[11px]">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            {columns.map((column) => (
              <th
                key={column}
                className="border-b border-slate-200 px-3 py-3 font-bold"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {busy &&
            [1, 2, 3].map((item) => (
              <tr key={item}>
                <td colSpan={columns.length} className="p-3">
                  <div className="h-8 animate-pulse rounded bg-slate-100" />
                </td>
              </tr>
            ))}
          {!busy &&
            records.map((record, index) => (
              <tr key={String(record.id)} className="hover:bg-slate-50">
                <td className="px-3 py-3 text-slate-500">{index + 1}</td>
                <td className="px-3 py-3">{recordText(record, "registration_no")}</td>
                <td className="px-3 py-3 font-medium text-brand">{recordText(record, "ref_id")}</td>
                <td className="max-w-32 px-3 py-3">{dateText(record.created_at)}</td>
                <td className="px-3 py-3 font-medium text-ink">{recordText(record, "customer_name")}</td>
                <td className="px-3 py-3">{recordText(record, "mobile")}</td>
                <td className="max-w-48 whitespace-normal px-3 py-3">{recordText(record, "address")}</td>
                <td className="px-3 py-3">{recordText(record, "brand")}</td>
                <td className="px-3 py-3">{recordText(record, "model")}</td>
                <td className="px-3 py-3">{recordText(record, "variant")}</td>
                <td className="px-3 py-3">{recordText(record, "assigned_to_name", user.name)}</td>
                <td className="px-3 py-3">
                  <StatusBadge status={recordText(record, "status", "pending")} />
                </td>
                <td className="px-3 py-3">
                  <button
                    className="rounded-md bg-brand px-3 py-2 text-[10px] font-bold text-white hover:bg-brand-dark"
                    onClick={() => onInspect(record)}
                  >
                    QC Inspect
                  </button>
                </td>
              </tr>
            ))}
          {!busy && !records.length && (
            <tr>
              <td colSpan={columns.length} className="px-6 py-16 text-center text-sm text-muted">
                No quality checks match these filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const steps = ["Images", "Details", "Inspection", "Recommendation"];

export function InspectionWorkflow({
  selection,
  onBack,
}: {
  selection: WorkflowSelection;
  onBack: () => void;
}) {
  const [step, setStep] = useState(0);
  const [expanded, setExpanded] = useState(0);
  const noteField = selection.resource === "quality-checks" ? "findings" : "notes";
  const [notes, setNotes] = useState(recordText(selection.record, noteField, ""));
  const [recommendation, setRecommendation] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(
    () => () => images.forEach((image) => URL.revokeObjectURL(image)),
    [images],
  );

  async function save(complete: boolean) {
    setError("");
    setMessage("");
    setBusy(true);
    try {
      await api.update(selection.resource, Number(selection.record.id), {
        [noteField]: notes,
      });
      const currentStatus = recordText(selection.record, "status");
      if (complete && currentStatus !== "completed") {
        await api.requestStatus(
          selection.resource,
          Number(selection.record.id),
          "completed",
          recommendation || "Inspection completed.",
        );
      }
      setMessage(
        complete
          ? "Inspection details saved and completion submitted for approval."
          : "Inspection details saved.",
      );
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to save inspection.");
    } finally {
      setBusy(false);
    }
  }

  function chooseImages(files: FileList | null) {
    setImages((current) => {
      current.forEach((image) => URL.revokeObjectURL(image));
      return files ? Array.from(files).map((file) => URL.createObjectURL(file)) : [];
    });
  }

  const sections = [
    {
      title: "Vehicle Images",
      content: (
        <div>
          <h3 className="text-sm font-semibold text-ink">Capture Vehicle Images</h3>
          <p className="mt-1 text-xs leading-5 text-muted">
            Select photos from your device. Images are previewed here and are not uploaded by this workspace.
          </p>
          <label className="mt-4 flex cursor-pointer items-center justify-center rounded-lg bg-brand px-4 py-3 text-xs font-semibold text-white hover:bg-brand-dark">
            ▣ Start Image Capture / Select from Gallery
            <input
              className="sr-only"
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              onChange={(event) => chooseImages(event.target.files)}
            />
          </label>
          {!!images.length && (
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {images.map((image, index) => (
                <img
                  key={image}
                  className="h-28 w-full rounded-lg border border-slate-200 object-cover"
                  src={image}
                  alt={`Vehicle preview ${index + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Vehicle Details",
      content: (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Registration Number", "registration_no"],
            ["Reference ID", "ref_id"],
            ["Customer Name", "customer_name"],
            ["Mobile Number", "mobile"],
            ["Brand", "brand"],
            ["Model", "model"],
            ["Variant", "variant"],
          ].map(([label, key]) => (
            <div key={key}>
              <p className="field-label">{label}</p>
              <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-ink">
                {recordText(selection.record, key)}
              </p>
            </div>
          ))}
        </div>
      ),
    },
    {
      title: "Inspection Details",
      content: (
        <div>
          <label className="field-label" htmlFor="inspection-notes">
            Inspection findings and notes
          </label>
          <textarea
            id="inspection-notes"
            className="field-control min-h-36"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Record vehicle condition, issues, and inspection observations…"
          />
        </div>
      ),
    },
    {
      title: "Recommendation",
      content: (
        <div className="space-y-3">
          <label className="field-label" htmlFor="inspection-recommendation">
            Recommendation
          </label>
          <select
            id="inspection-recommendation"
            className="field-control"
            value={recommendation}
            onChange={(event) => setRecommendation(event.target.value)}
          >
            <option value="">Select a recommendation</option>
            <option value="Approved for listing">Approved for listing</option>
            <option value="Needs correction">Needs correction</option>
            <option value="Further review required">Further review required</option>
          </select>
          <p className="text-xs leading-5 text-muted">
            Completing the workflow submits the status change to the administrator review queue.
          </p>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-[.16em] text-brand">
            Operations
          </p>
          <h1 className="text-2xl font-semibold text-ink">Vehicle Inspection</h1>
          <p className="mt-1 text-sm text-muted">
            {recordText(selection.record, "registration_no")} ·{" "}
            {recordText(selection.record, "customer_name")}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => window.print()}>
            ▣ Print Report
          </button>
          <button className="btn-secondary" onClick={onBack}>
            Back
          </button>
        </div>
      </div>
      <section className="card mb-5 p-5">
        <div className="grid grid-cols-4 gap-2 sm:gap-4">
          {steps.map((label, index) => (
            <button
              key={label}
              className="group text-center"
              onClick={() => {
                setStep(index);
                setExpanded(index);
              }}
            >
              <span
                className={`mx-auto grid h-8 w-8 place-items-center rounded-full text-xs font-bold ${
                  step === index
                    ? "bg-brand-navy text-white ring-4 ring-brand-soft"
                    : step > index
                      ? "bg-brand text-white"
                      : "bg-slate-100 text-slate-500"
                }`}
              >
                {index + 1}
              </span>
              <span className="mt-2 block text-[10px] font-medium text-slate-600 sm:text-xs">
                {label}
              </span>
            </button>
          ))}
        </div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-navy to-brand-cyan transition-all"
            style={{ width: `${((step + 1) / steps.length) * 100}%` }}
          />
        </div>
        <p className="mt-2 text-right text-[10px] text-muted">
          Step {step + 1} of {steps.length}
        </p>
      </section>
      <section className="card space-y-2 p-3 sm:p-5">
        {sections.map((section, index) => (
          <article
            key={section.title}
            className="overflow-hidden rounded-lg border border-slate-200"
          >
            <button
              className="flex w-full items-center justify-between bg-brand-navy px-4 py-3 text-left text-sm font-semibold text-white"
              aria-expanded={expanded === index}
              onClick={() => {
                setExpanded(expanded === index ? -1 : index);
                setStep(index);
              }}
            >
              <span>{section.title}</span>
              <span aria-hidden="true">{expanded === index ? "⌃" : "⌄"}</span>
            </button>
            {expanded === index && (
              <div className="p-4 sm:p-5">
                {section.content}
                <div className="mt-5 flex flex-wrap justify-between gap-2 border-t border-slate-200 pt-4">
                  <button
                    className="btn-secondary"
                    disabled={index === 0}
                    onClick={() => {
                      const previous = Math.max(0, index - 1);
                      setStep(previous);
                      setExpanded(previous);
                    }}
                  >
                    ← Previous
                  </button>
                  {index < sections.length - 1 ? (
                    <button
                      className="btn-primary"
                      onClick={() => {
                        setStep(index + 1);
                        setExpanded(index + 1);
                      }}
                    >
                      Proceed to {sections[index + 1].title} →
                    </button>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="btn-secondary"
                        disabled={busy}
                        onClick={() => void save(false)}
                      >
                        {busy ? "Saving…" : "Save Progress"}
                      </button>
                      <button
                        className="btn-primary"
                        disabled={busy}
                        onClick={() => void save(true)}
                      >
                        {busy ? "Saving…" : "Complete Inspection"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </article>
        ))}
        {error && (
          <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
            {message}
          </p>
        )}
      </section>
    </>
  );
}
