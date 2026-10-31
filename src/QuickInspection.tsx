import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { AuthUser } from "../shared/contracts";
import { api } from "./api";

type RecordData = Record<string, unknown>;
type Field = { key: string; label: string; options?: string[] };

function pdiValues(value: unknown): RecordData {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === "object" ? parsed as RecordData : {};
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" ? value as RecordData : {};
}

const choices = ["Good", "Okay", "Working", "Normal", "Clean", "Effective", "Satisfactory", "Original", "PASS", "No Error Code Found", "Not Available", "Damaged", "Not Working", "Needs Attention", "Repaired", "Repainted", "Cracked", "Torn", "Dirty", "Low", "High", "Leakage", "Abnormal", "Issue Found", "Error Found"];
const sections: { title: string; fields: Field[] }[] = [
  { title: "Vehicle identity", fields: [
    { key: "inspection_type", label: "Inspection type", options: ["New car PDI", "Preowned car PDI"] },
    { key: "vin_plate_condition", label: "VIN plate condition", options: ["Clearly visible", "Damaged", "Not Available"] },
    { key: "fuel_type", label: "Fuel type", options: ["Petrol", "Diesel", "CNG", "Electric", "Hybrid"] },
    { key: "transmission", label: "Transmission", options: ["Manual", "Automatic", "AMT", "CVT", "DCT"] },
    { key: "manufacturing_month", label: "Manufacturing month" }, { key: "manufacturing_year", label: "Manufacturing year" },
    { key: "vin_chassis_number", label: "VIN / Chassis number" }, { key: "engine_number", label: "Engine number" },
    { key: "odometer_readings", label: "Odometer readings" }, { key: "duplicate_key", label: "Duplicate key", options: ["Yes", "No"] },
  ] },
  { title: "Exterior and body", fields: [
    ...["front_bumper", "rear_bumper", "bonnet_hood", "roof", "boot_door", "boot_floor", "front_left_fender", "front_right_fender", "right_quarter_panel", "front_right_door", "front_left_door", "rear_right_door", "rear_left_door", "lhs_a_pillar", "lhs_b_pillar", "lhs_c_pillar", "rhs_a_pillar", "rhs_b_pillar", "rhs_c_pillar", "lhs_apron", "rhs_apron", "cowl_top", "lower_member_radiator_support", "upper_member", "front_windshield", "rear_windshield", "paint_thickness_reading"].map((key) => ({ key, label: key.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()), options: choices })),
  ] },
  { title: "Tyres and wheels", fields: [
    { key: "right_front_tyre", label: "Right front tyre", options: ["0-25%", "25-50%", "50-75%", "75-100%", "Cut", "Crack"] },
    { key: "right_rear_tyre", label: "Right rear tyre", options: ["0-25%", "25-50%", "50-75%", "75-100%", "Cut", "Crack"] },
    { key: "left_front_tyre", label: "Left front tyre", options: ["0-25%", "25-50%", "50-75%", "75-100%", "Cut", "Crack"] },
    { key: "left_rear_tyre", label: "Left rear tyre", options: ["0-25%", "25-50%", "50-75%", "75-100%", "Cut", "Crack"] },
    { key: "tyre_brand", label: "Tyre brand" }, { key: "rh_tyre_mfg", label: "RH tyre manufacturing" }, { key: "lh_tyre_mfg", label: "LH tyre manufacturing" },
    { key: "spare_tyre_condition", label: "Spare tyre condition", options: ["Good", "Need Replacement"] }, { key: "spare_tyre_mfg", label: "Spare tyre manufacturing" }, { key: "spare_tyre_brand", label: "Spare tyre brand" },
    { key: "wheel_rim_condition", label: "Wheel / rim condition", options: ["Good", "Not Good"] },
  ] },
  { title: "Features and electrical", fields: [
    ...["front_power_windows", "rear_power_windows", "music_system", "instrument_cluster_gauges_lamps", "reverse_camera", "parking_sensors", "gps_navigation_type", "infotainment", "horn", "head_light_right", "head_light_left", "fog_light_right", "fog_light_left", "tail_light_right", "tail_light_left", "indicators", "hazard_lights", "front_wipers", "rear_wiper", "head_light_washer", "orvm_right", "orvm_left", "sunroof_panoramic", "sunroof_moonroof_curtain", "smart_key", "push_start", "cruise_control", "ambient_lighting", "airbags", "rear_defogger", "central_locking", "usb_port", "dashcam", "alternator", "self_starter_motor", "combination_switch_or_assembly"].map((key) => ({ key, label: key.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()), options: choices })),
    { key: "number_of_airbags", label: "Number of airbags" }, { key: "gps_navigation_type", label: "GPS navigation type", options: ["In-build", "Android Auto / CarPlay", "Not Available"] },
  ] },
  { title: "AC and interior", fields: [
    ...["ac_cooling", "rear_ac_cooling", "heater", "blower_motor_noise", "auto_climate_control", "dual_zone_ac", "cooled_glovebox", "proper_air_flow", "seat_cover", "roof_carpet", "seat_adjustment", "seat_height_adjustment", "electrical_adjustable_seats", "ventilated_seats", "dashboard", "door_trims", "floor_carpet", "seat_belt"].map((key) => ({ key, label: key.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()), options: choices })),
  ] },
  { title: "Engine and mechanical", fields: [
    ...["engine_coolant_level", "engine_oil", "engine_sound", "exhaust_smoke", "brake_fluid", "washer_fluid", "battery_make", "firewall", "gear_shifting", "clutch_operation", "suspension", "brakes", "steering_adjustment", "steering_mounted_audio_controls", "smoke_exhaust", "emission"].map((key) => ({ key, label: key.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()), options: choices })),
  ] },
  { title: "Underbody and fitment", fields: [
    ...["rh_qtr_panel_robotic_punches", "lh_qtr_panel_robotic_punches", "right_panel_cladding", "left_panel_cladding", "right_panel_sash_tape", "left_panel_sash_tape", "right_panel_alignment", "left_panel_alignment", "right_wheel_hub_nut_area", "left_wheel_hub_nut_area", "right_door_breading", "left_door_breading", "right_brake_disc", "left_brake_disc", "right_wheel_knuckle", "left_wheel_knuckle", "front_skid_plate", "front_cowltop_cover_breading", "front_engine_underbody_cover", "sunroof_breading", "roof_breading", "spoiler", "electric_gesture_tailgate", "connecting_tail_light", "back_skid_plate", "back_door_breading"].map((key) => ({ key, label: key.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()), options: choices })),
  ] },
  { title: "Diagnostics and final assessment", fields: [
    { key: "cluster_meter_warning_light", label: "Cluster meter warning light", options: ["Off", "On"] }, { key: "obd_scanning_done", label: "OBD scanning done?", options: ["Yes", "No"] },
    { key: "ecm_engine_control_module", label: "ECM - engine control module", options: ["OK", "Error Found"] }, { key: "tcm_transmission_control_module", label: "TCM - transmission control module", options: ["OK", "Error Found"] },
    { key: "bcm_body_control_module", label: "BCM - body control module", options: ["OK", "Error Found"] }, { key: "abs_module", label: "ABS module", options: ["OK", "Error Found"] },
    { key: "airbags_srs_module", label: "Airbags / SRS module", options: ["OK", "Error Found"] }, { key: "adas", label: "ADAS", options: ["OK", "Error Found"] },
    { key: "error_codes", label: "Error codes", options: ["No Error Code Found", "Error Code Found"] }, { key: "enter_error_code", label: "Enter error code" },
    { key: "meter_tempering_suspected", label: "Meter tempering suspected?", options: ["Yes", "No"] }, { key: "overall_pdi_rating", label: "Overall PDI rating", options: ["1", "2", "3", "4", "5"] },
    { key: "overall_status", label: "Overall status", options: ["PASS", "PASS with Minor Observations", "FAIL"] },
  ] },
];

const allFields = sections.flatMap((section) => section.fields).filter((field, index, list) => list.findIndex((item) => item.key === field.key) === index);
const labelFor = (key: string) => allFields.find((field) => field.key === key)?.label ?? key.replaceAll("_", " ");

function baseValue(record?: RecordData): RecordData {
  const pdi = pdiValues(record?.pdi_data);
  return {
    ref_id: String(record?.ref_id ?? `PDI-${Date.now()}`),
    registration_no: String(record?.registration_no ?? ""),
    customer_name: String(record?.customer_name ?? ""),
    mobile: String(record?.mobile ?? ""),
    scheduled_at: String(
      record?.scheduled_at ?? new Date().toISOString().slice(0, 16),
    ),
    ...pdi,
  };
}

const reportFields = [
  { key: "customer_name", label: "Customer name", required: true },
  { key: "mobile", label: "Customer contact number", required: true },
  { key: "registration_no", label: "Registration number", required: true },
  { key: "scheduled_at", label: "Date of inspection", type: "datetime-local" },
  { key: "ref_id", label: "Report reference" },
];

const tabs = [
  { id: "details", label: "Report details", shortLabel: "Details" },
  { id: "vehicle", label: "Vehicle identity", shortLabel: "Vehicle" },
  { id: "exterior", label: "Exterior and body", shortLabel: "Exterior" },
  { id: "tyres", label: "Tyres and wheels", shortLabel: "Tyres" },
  { id: "systems", label: "Interior and systems", shortLabel: "Systems" },
  { id: "final", label: "Final assessment", shortLabel: "Final" },
] as const;

const tabSections = [
  undefined,
  sections[0],
  sections[1],
  sections[2],
  { title: "Interior and systems", fields: [...sections[3].fields, ...sections[4].fields, ...sections[5].fields, ...sections[6].fields] },
  sections[7],
];

type TabId = (typeof tabs)[number]["id"];

function Report({ record, onClose }: { record: RecordData; onClose: () => void }) {
  const pdi = pdiValues(record.pdi_data);
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 p-4 sm:p-8">
    <article id="inspection-report" className="mx-auto max-w-5xl rounded-2xl bg-white p-6 shadow-2xl sm:p-10">
      <header className="flex items-start justify-between border-b border-line pb-6">
        <div><p className="text-xs font-bold uppercase tracking-[.18em] text-brand">AutoSureX</p><h1 className="mt-2 text-3xl font-semibold text-ink">Pre-delivery Inspection Report</h1><p className="mt-1 text-sm text-muted">PRUVO PDI checklist · {String(record.ref_id)}</p></div>
        <div className="flex gap-2 print:hidden"><button className="btn-primary" onClick={() => window.print()}>Print report</button><button className="btn-secondary" onClick={onClose}>Close</button></div>
      </header>
      <section className="mt-6 grid gap-4 rounded-xl bg-slate-50 p-5 sm:grid-cols-4">
        {([["Customer", record.customer_name], ["Contact", record.mobile], ["Registration", record.registration_no], ["Inspection date", record.scheduled_at]] as const).map(([label, value]) => <div key={label}><p className="text-xs text-muted">{label}</p><p className="mt-1 font-semibold text-ink">{String(value || "—")}</p></div>)}
      </section>
      {sections.map((section) => <section key={section.title} className="mt-7"><h2 className="border-b border-line pb-2 text-sm font-bold uppercase tracking-wide text-brand">{section.title}</h2><div className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">{section.fields.map((field) => <div key={field.key} className="flex justify-between gap-4 border-b border-slate-100 py-1.5 text-sm"><span className="text-muted">{field.label}</span><strong className="text-right text-ink">{String(pdi[field.key] || "—")}</strong></div>)}</div></section>)}
      <section className="mt-7 border-t border-line pt-5"><p className="text-xs font-bold uppercase tracking-wide text-brand">Engineer's comment</p><p className="mt-2 whitespace-pre-wrap text-sm text-ink">{String(pdi.engineer_comment || "—")}</p></section>
    </article>
  </div>;
}

function ImageUpload({
  tab,
  images,
  onChange,
}: {
  tab: TabId;
  images: Record<string, string[]>;
  onChange: (tab: TabId, files: FileList | null) => void;
}) {
  if (!["exterior", "tyres", "final"].includes(tab)) return null;
  const labels: Record<string, string> = {
    exterior: "Add exterior photos",
    tyres: "Add tyre and wheel photos",
    final: "Add supporting documents or final photos",
  };
  const previews = images[tab] ?? [];
  return <div className="mt-7 rounded-xl border border-dashed border-brand/30 bg-brand-soft/40 p-4 sm:p-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div><p className="text-sm font-semibold text-ink">{labels[tab]}</p><p className="mt-1 text-xs text-muted">Use clear photos in good light. You can select multiple images.</p></div>
      <label className="btn-secondary cursor-pointer text-center"><span>Choose images</span><input className="sr-only" type="file" accept="image/*" multiple onChange={(event) => onChange(tab, event.target.files)} /></label>
    </div>
    {!!previews.length && <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{previews.map((src, index) => <img key={src} src={src} alt={`${labels[tab]} ${index + 1}`} className="h-28 w-full rounded-lg border border-line bg-white object-cover" />)}</div>}
  </div>;
}

export function QuickInspection({ user: _user }: { user: AuthUser }) {
  const [records, setRecords] = useState<RecordData[]>([]);
  const [record, setRecord] = useState<RecordData | undefined>();
  const [mode, setMode] = useState<"list" | "form">("list");
  const [report, setReport] = useState<RecordData>();
  const [form, setForm] = useState<RecordData>(() => baseValue());
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<TabId>("details");
  const [images, setImages] = useState<Record<string, string[]>>({});

  const load = useCallback(() => {
    setBusy(true);
    void api.list("inspections", { page: 1, pageSize: 100, sort: "created_at", direction: "desc" })
      .then((result) => setRecords(result.data.filter((item) => Object.keys(pdiValues(item.pdi_data)).length)))
      .catch((failure) => setError(failure instanceof Error ? failure.message : "Unable to load inspections."))
      .finally(() => setBusy(false));
  }, []);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  const visible = useMemo(() => records.filter((item) => `${item.ref_id} ${item.registration_no} ${item.customer_name} ${item.mobile}`.toLowerCase().includes(query.toLowerCase())), [records, query]);

  function start(next?: RecordData) {
    const nextPdi = pdiValues(next?.pdi_data);
    setRecord(next);
    setForm(baseValue(next));
    setImages({
      exterior: String(nextPdi.exterior_photo_urls ?? "").split(",").filter(Boolean),
      tyres: String(nextPdi.tyres_photo_urls ?? "").split(",").filter(Boolean),
      final: String(nextPdi.final_photo_urls ?? "").split(",").filter(Boolean),
    });
    setTab("details");
    setMode("form");
    setError("");
  }
  function setField(key: string, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }
  async function handleImages(tabId: TabId, files: FileList | null) {
    if (!files?.length) return;
    setError("");
    setBusy(true);
    try {
      const selectedFiles = Array.from(files).slice(0, 8);
      const result = await api.uploadImages(selectedFiles);
      const urls = result.data.map((item) => item.url);
      setImages((current) => ({ ...current, [tabId]: [...(current[tabId] ?? []), ...urls].slice(0, 8) }));
      setForm((current) => ({
        ...current,
        [`${tabId}_photo_names`]: selectedFiles.map((file) => file.name).join(", ").slice(0, 2000),
        [`${tabId}_photo_urls`]: [...((current[`${tabId}_photo_urls`] as string) ?? "").split(",").filter(Boolean), ...urls].slice(0, 8).join(","),
      }));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to upload images.");
    } finally {
      setBusy(false);
    }
  }
  function validateTab(tabId: TabId) {
    if (tabId !== "details") return true;
    if (!form.customer_name || !form.mobile || !form.registration_no) {
      setError("Customer name, contact number, and registration number are required.");
      return false;
    }
    return true;
  }
  function moveTab(direction: -1 | 1) {
    if (direction === 1 && !validateTab(tab)) return;
    const index = tabs.findIndex((item) => item.id === tab);
    const next = tabs[index + direction];
    if (next) { setError(""); setTab(next.id); }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!validateTab("details")) return;
    setError("");
    const pdi_data = Object.fromEntries(allFields.map((field) => [field.key, String(form[field.key] ?? "").trim()]).filter(([, value]) => value));
    Object.entries(form).filter(([key]) => key.endsWith("_photo_names") || key.endsWith("_photo_urls")).forEach(([key, value]) => { if (value) pdi_data[key] = String(value); });
    try {
      const payload = { ref_id: String(form.ref_id), registration_no: String(form.registration_no), customer_name: String(form.customer_name), mobile: String(form.mobile), scheduled_at: String(form.scheduled_at || new Date().toISOString()), notes: String(pdi_data.engineer_comment || ""), pdi_data };
      if (record?.id) await api.update("inspections", Number(record.id), payload); else await api.create("inspections", payload);
      load(); setMode("list");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Unable to save inspection."); }
  }
  if (mode === "form") {
    const activeTab = tabs.findIndex((item) => item.id === tab);
    const activeSection = tabSections[activeTab];
    return <form onSubmit={save} className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-brand">Quick Inspection</p><h1 className="mt-1 text-2xl font-semibold text-ink sm:text-3xl">{record ? "Edit PDI report" : "New PDI report"}</h1><p className="mt-1 text-sm text-muted">Complete each step at your own pace. Your report stays easy to use on mobile and web.</p></div><div className="flex gap-2"><button type="button" className="btn-secondary flex-1 sm:flex-none" onClick={() => setMode("list")}>Cancel</button><button className="btn-primary flex-1 sm:flex-none" disabled={busy}>Save report</button></div></div>
      <div className="card overflow-hidden">
        <div className="border-b border-line bg-slate-50 px-4 py-4 sm:px-6"><div className="mb-3 flex items-center justify-between text-xs font-semibold text-muted"><span>Step {activeTab + 1} of {tabs.length}</span><span>{Math.round(((activeTab + 1) / tabs.length) * 100)}% complete</span></div><div className="h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-brand transition-all" style={{ width: `${((activeTab + 1) / tabs.length) * 100}%` }} /></div></div>
        <nav className="scrollbar-thin flex overflow-x-auto border-b border-line" aria-label="PDI report steps">{tabs.map((item, index) => <button key={item.id} type="button" onClick={() => { if (index <= activeTab || validateTab(tab)) { setError(""); setTab(item.id); } }} className={`min-w-[110px] flex-1 border-b-2 px-3 py-3 text-left text-xs font-semibold transition sm:min-w-0 sm:px-5 sm:text-sm ${tab === item.id ? "border-brand bg-brand-soft text-brand" : "border-transparent text-muted hover:bg-slate-50"}`}><span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] ring-1 ring-line">{index + 1}</span><span className="sm:hidden">{item.shortLabel}</span><span className="hidden sm:inline">{item.label}</span></button>)}</nav>
        <div className="p-4 sm:p-7">
          {error && <div role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
          {tab === "details" && <section><h2 className="text-base font-semibold text-ink">Report details</h2><p className="mt-1 text-sm text-muted">Start with the customer and vehicle information.</p><div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{reportFields.map((field) => <label key={field.key} className="field-label">{field.label}{field.required && <span className="text-rose-500"> *</span>}<input required={field.required} type={field.type ?? "text"} className="field-control mt-1" value={String(form[field.key] ?? "")} onChange={(event) => setField(field.key, event.target.value)} /></label>)}</div></section>}
          {activeSection && <section><h2 className="text-base font-semibold text-ink">{activeSection.title}</h2><p className="mt-1 text-sm text-muted">Choose the closest condition for each checkpoint.</p><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{activeSection.fields.map((field) => <label key={field.key} className="field-label">{field.label}{field.options ? <select className="field-control mt-1" value={String(form[field.key] ?? "")} onChange={(event) => setField(field.key, event.target.value)}><option value="">Select</option>{field.options.map((option) => <option key={option}>{option}</option>)}</select> : <input className="field-control mt-1" value={String(form[field.key] ?? "")} onChange={(event) => setField(field.key, event.target.value)} />}</label>)}</div>{tab === "final" && <label className="field-label mt-6">Engineer's comment<textarea className="field-control mt-1 min-h-28" placeholder="Add observations, defects, or recommendations" value={String(form.engineer_comment ?? "")} onChange={(event) => setField("engineer_comment", event.target.value)} /></label>}</section>}
          <ImageUpload tab={tab} images={images} onChange={handleImages} />
        </div>
        <div className="flex flex-col-reverse gap-3 border-t border-line bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-7"><button type="button" className="btn-secondary w-full sm:w-auto" disabled={activeTab === 0} onClick={() => moveTab(-1)}>← Previous</button>{activeTab < tabs.length - 1 ? <button type="button" className="btn-primary w-full sm:w-auto" onClick={() => moveTab(1)}>Save and continue →</button> : <button type="submit" className="btn-primary w-full sm:w-auto" disabled={busy}>Save PDI report</button>}</div>
      </div>
    </form>;
  }
  return <div><div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-brand">Quick Inspection</p><h1 className="mt-1 text-2xl font-semibold text-ink">Quick Inspection <span className="ml-2 text-sm font-medium text-muted">{records.length}</span></h1><p className="mt-1 text-sm text-muted">Create, track, and print complete pre-delivery inspection reports.</p></div><button className="btn-primary w-full sm:w-auto" onClick={() => start()}>＋ New PDI report</button></div><section className="card overflow-hidden"><div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold text-ink">Inspection reports</h2><p className="mt-1 text-xs text-muted">View or update the full checklist at any time.</p></div><input className="field-control max-w-sm" placeholder="Search customer, vehicle or reference…" value={query} onChange={(event) => setQuery(event.target.value)} /></div><div className="overflow-x-auto"><table className="w-full text-left"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-muted"><tr><th className="px-5 py-3">Reference</th><th className="px-5 py-3">Customer</th><th className="px-5 py-3">Vehicle</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{visible.map((item) => { const pdi = pdiValues(item.pdi_data); return <tr key={String(item.id)} className="hover:bg-slate-50"><td className="px-5 py-4 text-sm font-semibold text-brand">{String(item.ref_id)}</td><td className="px-5 py-4 text-sm text-ink"><div className="font-medium">{String(item.customer_name)}</div><div className="text-xs text-muted">{String(item.mobile)}</div></td><td className="px-5 py-4 text-sm text-slate-600">{String(item.registration_no)}<div className="text-xs text-muted">{String(pdi.inspection_type || "PDI")}</div></td><td className="px-5 py-4"><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">{String(pdi.overall_status || "Draft")}</span></td><td className="px-5 py-4"><div className="flex justify-end gap-2"><button className="btn-secondary !px-3 !py-1.5 text-xs" onClick={() => setReport(item)}>View</button><button className="btn-secondary !px-3 !py-1.5 text-xs" onClick={() => start(item)}>Edit</button><button className="btn-primary !px-3 !py-1.5 text-xs" onClick={() => setReport(item)}>Report</button></div></td></tr>; })}</tbody></table></div>{busy && <p className="p-8 text-center text-sm text-muted">Loading inspections…</p>}{!busy && !visible.length && <p className="p-12 text-center text-sm text-muted">No PDI reports found. Create the first inspection to get started.</p>}</section>{error && <p role="alert" className="mt-4 text-sm text-rose-600">{error}</p>}{report && <Report record={report} onClose={() => setReport(undefined)} />}</div>;
}
