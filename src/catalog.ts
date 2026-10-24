import type { ResourceName } from "../shared/contracts";

export interface FieldDefinition {
  key: string;
  label: string;
  type?:
    | "text"
    | "number"
    | "date"
    | "datetime-local"
    | "email"
    | "tel"
    | "textarea"
    | "select"
    | "checkbox";
  options?: string[];
  required?: boolean;
  wide?: boolean;
}

export interface ResourceDefinition {
  name: string;
  singular: string;
  description: string;
  fields: FieldDefinition[];
  columns: string[];
  filterStatus?: string[];
  statusKey?: string;
}

const field = (
  key: string,
  label: string,
  options: Partial<FieldDefinition> = {},
): FieldDefinition => ({
  key,
  label,
  ...options,
});

export const resources: Record<ResourceName, ResourceDefinition> = {
  listings: {
    name: "Vehicle listings",
    singular: "listing",
    description:
      "Manage vehicle inventory, seller details, pricing, and listing visibility.",
    fields: [
      field("registration_no", "Registration number", { required: true }),
      field("ref_id", "Reference ID", { required: true }),
      field("seller_id", "Seller ID", { type: "number" }),
      field("brand", "Brand", { required: true }),
      field("model", "Model", { required: true }),
      field("model_year", "Model year", { type: "number", required: true }),
      field("variant", "Variant", { required: true }),
      field("body_type", "Body type", { required: true }),
      field("fuel_type", "Fuel type", {
        type: "select",
        options: ["petrol", "diesel", "electric", "hybrid", "cng", "lpg"],
        required: true,
      }),
      field("transmission", "Transmission", {
        type: "select",
        options: ["manual", "automatic", "amt", "cvt"],
        required: true,
      }),
      field("kilometers", "Kilometers", { type: "number", required: true }),
      field("color", "Color", { required: true }),
      field("price", "Price (INR)", { type: "number", required: true }),
      field("registration_date", "Registration date", {
        type: "date",
        required: true,
      }),
      field("owner_count", "Owner number", { type: "number", required: true }),
      field("insurance_type", "Insurance type", { required: true }),
      field("insurance_expiry", "Insurance expiry", { type: "date" }),
      field("state", "State", { required: true }),
      field("city", "City", { required: true }),
      field("seller_name", "Seller name", { required: true }),
      field("seller_mobile", "Seller mobile", { type: "tel", required: true }),
      field("address", "Address", { wide: true, required: true }),
      field("description", "Description", {
        type: "textarea",
        wide: true,
        required: true,
      }),
      field("features", "Features (comma-separated)", { wide: true }),
      field("status", "Listing status", {
        type: "select",
        options: ["draft", "available", "reserved", "sold", "archived"],
        required: true,
      }),
      field("is_featured", "Featured listing", { type: "checkbox" }),
      field("is_home", "Show on homepage", { type: "checkbox" }),
    ],
    columns: [
      "registration_no",
      "brand",
      "model",
      "model_year",
      "city",
      "price",
      "status",
    ],
    filterStatus: ["draft", "available", "reserved", "sold", "archived"],
    statusKey: "status",
  },
  dealers: {
    name: "Dealers",
    singular: "dealer",
    description: "Maintain dealer contact records.",
    fields: [
      field("name", "Dealer name", { required: true }),
      field("email", "Email address", { type: "email", required: true }),
      field("contact_no", "Contact number", { type: "tel", required: true }),
    ],
    columns: ["name", "email", "contact_no", "created_at"],
  },
  buyers: {
    name: "Buyers",
    singular: "buyer",
    description:
      "Manage buyer contact details, listing limits, and account status.",
    fields: [
      field("name", "Full name", { required: true }),
      field("email", "Email address", { type: "email", required: true }),
      field("contact_no", "Contact number", { type: "tel", required: true }),
      field("city", "City", { required: true }),
      field("listing_limit", "Listing limit", {
        type: "number",
        required: true,
      }),
      field("status", "Account status", {
        type: "select",
        options: ["active", "inactive", "pending"],
        required: true,
      }),
      field("registered_at", "Registered on", { type: "date", required: true }),
    ],
    columns: ["name", "email", "contact_no", "city", "listing_limit", "status"],
    filterStatus: ["active", "inactive", "pending"],
    statusKey: "status",
  },
  sellers: {
    name: "Sellers",
    singular: "seller",
    description: "Manage seller contact records independently from buyers.",
    fields: [
      field("name", "Full name", { required: true }),
      field("email", "Email address", { type: "email", required: true }),
      field("contact_no", "Contact number", { type: "tel", required: true }),
      field("city", "City", { required: true }),
      field("status", "Account status", {
        type: "select",
        options: ["active", "inactive", "pending"],
        required: true,
      }),
      field("registered_at", "Registered on", { type: "date", required: true }),
    ],
    columns: ["name", "email", "contact_no", "city", "status", "registered_at"],
    filterStatus: ["active", "inactive", "pending"],
    statusKey: "status",
  },
  "quick-listings": {
    name: "Quick listings",
    singular: "quick listing",
    description:
      "Capture an incoming vehicle request and coordinate inspection appointments.",
    fields: [
      field("ref_id", "Reference ID", { required: true }),
      field("registration_no", "Registration number", { required: true }),
      field("customer_name", "Customer name", { required: true }),
      field("mobile", "Mobile number", { type: "tel", required: true }),
      field("address", "Address", { wide: true, required: true }),
      field("city", "City", { required: true }),
      field("state", "State", { required: true }),
      field("pincode", "PIN code", { required: true }),
      field("brand", "Brand", { required: true }),
      field("model", "Model", { required: true }),
      field("variant", "Variant", { required: true }),
      field("price", "Expected price (INR)", {
        type: "number",
        required: true,
      }),
      field("appointment_at", "Appointment", { type: "datetime-local" }),
      field("assigned_to", "Assigned inspector", { type: "select" }),
    ],
    columns: [
      "ref_id",
      "registration_no",
      "customer_name",
      "mobile",
      "brand",
      "model",
      "appointment_at",
      "inspection_status",
    ],
    filterStatus: ["pending", "inspecting", "completed"],
    statusKey: "inspection_status",
  },
  inspections: {
    name: "Inspections",
    singular: "inspection",
    description:
      "Assign inspection work and submit status changes for administrator approval.",
    fields: [
      field("listing_id", "Listing ID", { type: "number" }),
      field("quick_listing_id", "Quick listing ID", { type: "number" }),
      field("ref_id", "Reference ID", { required: true }),
      field("registration_no", "Registration number", { required: true }),
      field("customer_name", "Customer name", { required: true }),
      field("mobile", "Mobile number", { type: "tel", required: true }),
      field("assigned_to", "Assigned inspector", { type: "select" }),
      field("scheduled_at", "Scheduled at", { type: "datetime-local" }),
      field("notes", "Inspection notes", { type: "textarea", wide: true }),
    ],
    columns: [
      "ref_id",
      "registration_no",
      "customer_name",
      "mobile",
      "assigned_to",
      "scheduled_at",
      "status",
    ],
    filterStatus: ["pending", "inspecting", "completed"],
    statusKey: "status",
  },
  "quality-checks": {
    name: "Quality checks",
    singular: "quality check",
    description:
      "Review inspection quality, record findings, and request reviewed status changes.",
    fields: [
      field("inspection_id", "Inspection ID", { type: "number" }),
      field("listing_id", "Listing ID", { type: "number" }),
      field("ref_id", "Reference ID", { required: true }),
      field("registration_no", "Registration number", { required: true }),
      field("customer_name", "Customer name", { required: true }),
      field("mobile", "Mobile number", { type: "tel", required: true }),
      field("assigned_to", "Assigned inspector", { type: "select" }),
      field("findings", "Quality findings", { type: "textarea", wide: true }),
    ],
    columns: [
      "ref_id",
      "registration_no",
      "customer_name",
      "mobile",
      "assigned_to",
      "status",
      "created_at",
    ],
    filterStatus: ["pending", "completed", "in_correction"],
    statusKey: "status",
  },
  repairs: {
    name: "Repair & maintenance",
    singular: "repair request",
    description:
      "Track repair and maintenance appointments and their fulfilment status.",
    fields: [
      field("registration_no", "Registration number", { required: true }),
      field("customer_name", "Customer name", { required: true }),
      field("mobile", "Mobile number", { type: "tel", required: true }),
      field("address", "Address", { wide: true, required: true }),
      field("city", "City", { required: true }),
      field("state", "State", { required: true }),
      field("pincode", "PIN code", { required: true }),
      field("brand", "Brand", { required: true }),
      field("model", "Model", { required: true }),
      field("variant", "Variant", { required: true }),
      field("work_type", "Work type", { required: true }),
      field("scheduled_date", "Date", { type: "date", required: true }),
      field("status", "Request status", {
        type: "select",
        options: [
          "requested",
          "scheduled",
          "in_progress",
          "completed",
          "cancelled",
        ],
        required: true,
      }),
      field("notes", "Notes", { type: "textarea", wide: true }),
    ],
    columns: [
      "registration_no",
      "customer_name",
      "mobile",
      "city",
      "work_type",
      "scheduled_date",
      "status",
    ],
    filterStatus: [
      "requested",
      "scheduled",
      "in_progress",
      "completed",
      "cancelled",
    ],
    statusKey: "status",
  },
};

export const navigation: {
  key: ResourceName | "dashboard" | "approvals";
  label: string;
  group: string;
}[] = [
  { key: "dashboard", label: "Overview", group: "Workspace" },
  { key: "listings", label: "Vehicle listings", group: "Inventory" },
  { key: "quick-listings", label: "Quick listings", group: "Inventory" },
  { key: "dealers", label: "Dealers", group: "People" },
  { key: "buyers", label: "Buyers", group: "People" },
  { key: "sellers", label: "Sellers", group: "People" },
  { key: "inspections", label: "Inspections", group: "Operations" },
  { key: "quality-checks", label: "Quality checks", group: "Operations" },
  { key: "repairs", label: "Repair & maintenance", group: "Operations" },
  { key: "approvals", label: "Status approvals", group: "Operations" },
];
