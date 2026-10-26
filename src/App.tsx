import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import type { AuthUser, ResourceName } from "../shared/contracts";
import { api, type DashboardMetrics, type StatusRequest } from "./api";
import { ApiRequestError } from "./api-errors";
import {
  InspectionWorkflow,
  InspectionWorkspace,
  type WorkflowSelection,
} from "./InspectionWorkspace";
import {
  navigation,
  resources,
  type FieldDefinition,
  type ResourceDefinition,
} from "./catalog";

type ViewKey = "dashboard" | "approvals" | "inspection-workflow" | ResourceName;
interface RecordPage {
  data: Record<string, unknown>[];
  page: number;
  pageSize: number;
  total: number;
}

const iconPaths: Record<string, string> = {
  dashboard: "M3 3h7v7H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 14h7v7H3z",
  listings: "M4 5h16M4 10h16M4 15h10M4 20h10",
  "quick-listings": "M12 5v14M5 12h14",
  dealers: "M3 21V7l9-4 9 4v14M3 11h18M8 21v-5h8v5",
  buyers:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M20 8v6M23 11h-6",
  sellers:
    "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M4 21a8 8 0 0 1 16 0M18 8h4M20 6v4",
  inspections: "M9 12l2 2 4-4M4 4h16v16H4z",
  "quality-checks": "M12 3l8 4v5c0 5-3.4 8-8 9-4.6-1-8-4-8-9V7zM9 12l2 2 4-4",
  repairs:
    "M14.7 6.3a5 5 0 0 0-6.4 6.4L3 18l3 3 5.3-5.3a5 5 0 0 0 6.4-6.4L14 12l-3-3z",
  approvals: "M9 12l2 2 4-4M4 4h16v16H4z",
};

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={iconPaths[name] ?? iconPaths.dashboard} />
    </svg>
  );
}

function formatValue(value: unknown, key: string): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean" || key.startsWith("is_"))
    return value ? "Yes" : "No";
  if (key === "price")
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(Number(value));
  if (Array.isArray(value)) return value.join(", ");
  const raw = String(value);
  if (key.endsWith("_at") || key.endsWith("_date") || key === "created_at") {
    const date = new Date(raw);
    if (!Number.isNaN(date.getTime()))
      return key.endsWith("_at")
        ? date.toLocaleString()
        : date.toLocaleDateString();
  }
  return raw.replaceAll("_", " ");
}

function statusClass(value: unknown): string {
  const status = String(value ?? "").toLowerCase();
  if (["available", "active", "completed", "approved"].includes(status))
    return "bg-emerald-50 text-emerald-700";
  if (["pending", "requested", "reserved", "inspecting"].includes(status))
    return "bg-amber-50 text-amber-700";
  if (
    [
      "sold",
      "inactive",
      "rejected",
      "cancelled",
      "archived",
      "in_correction",
    ].includes(status)
  )
    return "bg-rose-50 text-rose-700";
  return "bg-slate-100 text-slate-600";
}

function Login({ onLogin }: { onLogin: (user: AuthUser) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const result = await api.login(email, password, rememberMe);
      onLogin(result.user);
    } catch (failure) {
      setError(
        failure instanceof ApiRequestError && failure.requestId
          ? `${failure.message} (Reference: ${failure.requestId})`
          : failure instanceof Error
            ? failure.message
            : "Unable to sign in.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="flex min-h-screen bg-white">
      <section className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-brand-navy p-12 text-white lg:flex">
        <div className="absolute -right-32 -top-32 h-[30rem] w-[30rem] rounded-full border border-white/10" />
        <div className="absolute -right-10 -top-10 h-[25rem] w-[25rem] rounded-full border border-white/10" />
        <Brand inverse />
        <div className="relative max-w-lg">
          <span className="mb-5 inline-flex rounded-full border border-white/20 px-3 py-1 text-xs uppercase tracking-[.2em] text-brand-cyan">
            AutoSureX operations
          </span>
          <h1 className="text-5xl font-semibold leading-tight tracking-tight">
            Every detail.
            <br />
            In the right hands.
          </h1>
          <p className="mt-5 max-w-md text-base leading-7 text-sky-100/85">
            One workspace to keep vehicle inventory, inspections, and service
            moving smoothly.
          </p>
        </div>
        <p className="text-xs text-sky-100/70">
          Secure access for authorized team members
        </p>
      </section>
      <section className="flex flex-1 items-center justify-center px-5 py-12">
        <div className="w-full max-w-md">
          <div className="mb-10 lg:hidden">
            <Brand />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[.19em] text-brand">
            Welcome back
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-ink">
            Sign in to your account
          </h2>
          <p className="mt-2 text-sm text-muted">
            Use your administrator or team account to continue.
          </p>
          <form className="mt-8 space-y-5" onSubmit={submit}>
            <div>
              <label className="field-label" htmlFor="login-email">
                Email address
              </label>
              <input
                id="login-email"
                className="field-control"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="login-password">
                Password
              </label>
              <input
                id="login-password"
                className="field-control"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 accent-brand"
              />
              Remember me on this device
            </label>
            {error && (
              <div
                role="alert"
                className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
              >
                {error}
              </div>
            )}
            <button className="btn-primary w-full py-3" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}{" "}
              <span aria-hidden="true">→</span>
            </button>
          </form>
          <p className="mt-8 text-xs leading-5 text-slate-400">
            Access is monitored and limited to authorized AutoSureX personnel.
          </p>
        </div>
      </section>
    </main>
  );
}

function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <div className="relative flex items-center gap-3">
      <img
        src="/autosurex-logo.jpg"
        alt="AutoSureX logo"
        className="h-12 w-12 shrink-0 rounded-full border border-slate-200 object-cover"
      />
      <span className="min-w-0">
        <span
          className={`block text-lg font-bold tracking-tight ${inverse ? "text-white" : "text-ink"}`}
        >
          AutoSureX
        </span>
        <span
          className={`block text-[9px] font-semibold uppercase tracking-[.14em] ${inverse ? "text-white/65" : "text-slate-500"}`}
        >
          Pre-Delivery Inspection
        </span>
      </span>
    </div>
  );
}

function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [sessionError, setSessionError] = useState("");
  const [actionError, setActionError] = useState("");
  const [view, setView] = useState<ViewKey>("dashboard");
  const [workflowSelection, setWorkflowSelection] =
    useState<WorkflowSelection | null>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .me()
      .then(({ user: current }) => setUser(current))
      .catch((failure: unknown) => {
        if (failure instanceof ApiRequestError && failure.status === 401) {
          setUser(null);
        } else {
          setSessionError(
            failure instanceof Error
              ? failure.message
              : "Could not verify your session.",
          );
        }
      })
      .finally(() => setInitializing(false));
  }, []);

  useEffect(() => {
    if (!profileMenuOpen) return;
    function closeMenu(event: MouseEvent) {
      if (
        event.target instanceof Node &&
        !profileMenuRef.current?.contains(event.target)
      ) {
        setProfileMenuOpen(false);
      }
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setProfileMenuOpen(false);
    }
    document.addEventListener("mousedown", closeMenu);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeMenu);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [profileMenuOpen]);

  const signOut = async () => {
    setActionError("");
    try {
      await api.logout();
      setUser(null);
      setView("dashboard");
      setWorkflowSelection(null);
    } catch (failure) {
      setActionError(
        failure instanceof Error
          ? failure.message
          : "Unable to sign out. Please try again.",
      );
    }
  };

  if (initializing) {
    return (
      <main className="grid min-h-screen place-items-center bg-canvas">
        <div
          className="flex items-center gap-3 text-sm text-muted"
          role="status"
        >
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand border-r-transparent" />
          Checking secure session…
        </div>
      </main>
    );
  }
  if (sessionError) {
    return (
      <main className="grid min-h-screen place-items-center bg-canvas p-5">
        <section className="card w-full max-w-md p-7 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-amber-50 text-xl text-amber-700">
            !
          </span>
          <h1 className="mt-4 text-xl font-semibold text-ink">
            Unable to verify access
          </h1>
          <p role="alert" className="mt-2 text-sm leading-6 text-muted">
            {sessionError}
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <button
              className="btn-secondary"
              onClick={() => {
                setSessionError("");
                setInitializing(true);
                api
                  .me()
                  .then(({ user: current }) => setUser(current))
                  .catch((failure: unknown) => {
                    if (
                      failure instanceof ApiRequestError &&
                      failure.status === 401
                    )
                      setUser(null);
                    else
                      setSessionError(
                        failure instanceof Error
                          ? failure.message
                          : "Could not verify your session.",
                      );
                  })
                  .finally(() => setInitializing(false));
              }}
            >
              Retry
            </button>
            <button className="btn-primary" onClick={() => setSessionError("")}>
              Continue to sign in
            </button>
          </div>
        </section>
      </main>
    );
  }
  if (!user) return <Login onLogin={setUser} />;

  const visibleNavigation = navigation.filter((item) => {
    if (item.key === "approvals") return user.role === "admin";
    if (user.role === "inspector")
      return (
        item.key === "dashboard" ||
        item.key === "inspections" ||
        item.key === "quality-checks"
      );
    return true;
  });
  const activeNavigation =
    view === "inspection-workflow" ? workflowSelection?.resource : view;
  const currentTitle =
    view === "dashboard"
      ? "Overview"
      : view === "approvals"
        ? "Status approvals"
        : view === "inspection-workflow"
          ? "Vehicle Inspection"
          : resources[view].name;

  return (
    <div className="min-h-screen bg-canvas">
      {mobileNav && (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-slate-950/35 lg:hidden"
          onClick={() => setMobileNav(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[264px] flex-col border-r border-slate-100 bg-white transition-transform lg:translate-x-0 ${mobileNav ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex h-[76px] items-center border-b border-line px-6">
          <Brand />
        </div>
        <nav
          className="scrollbar-thin flex-1 overflow-y-auto px-3 py-5"
          aria-label="Main navigation"
        >
          {["Workspace", "Inventory", "People", "Operations"].map((group) => {
            const items = visibleNavigation.filter(
              (item) => item.group === group,
            );
            if (!items.length) return null;
            return (
              <div key={group} className="mb-6">
                <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[.16em] text-slate-400">
                  {group}
                </p>
                <ul className="space-y-1">
                  {items.map((item) => (
                    <li key={item.key}>
                      <button
                        onClick={() => {
                          setView(item.key);
                          setMobileNav(false);
                        }}
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition ${activeNavigation === item.key ? "bg-brand-soft text-brand" : "text-slate-600 hover:bg-slate-50 hover:text-ink"}`}
                        aria-current={activeNavigation === item.key ? "page" : undefined}
                      >
                        <Icon name={item.key} size={17} />
                        <span>{item.label}</span>
                        {item.key === "approvals" && (
                          <span className="ml-auto rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                            Review
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </nav>
        <div className="border-t border-line p-4">
          <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-bold text-brand">
              {user.name
                .split(/\s+/)
                .map((word) => word[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">
                {user.name}
              </p>
              <p className="text-xs capitalize text-muted">
                {user.role.replace("_", " ")}
              </p>
            </div>
            <button
              className="rounded-md p-1.5 text-slate-400 hover:bg-white hover:text-rose-600"
              aria-label="Sign out"
              title="Sign out"
              onClick={signOut}
            >
              ↗
            </button>
          </div>
        </div>
      </aside>
      <div className="min-h-screen lg:pl-[264px]">
        <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-line bg-white/90 px-4 backdrop-blur sm:px-7">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileNav(true)}
              aria-label="Open navigation"
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            >
              <span className="text-xl">☰</span>
            </button>
            <p className="hidden text-sm text-muted sm:block">
              Operations <span className="mx-2 text-slate-300">/</span>{" "}
              <span className="font-medium text-ink">
                {currentTitle}
              </span>
            </p>
            <p className="text-sm font-semibold text-ink sm:hidden">
              {currentTitle}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{" "}
              Secure session
            </span>
            <div className="relative" ref={profileMenuRef}>
              <button
                className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-xs font-bold text-white ring-offset-2 transition hover:ring-2 hover:ring-brand/30"
                aria-label="User profile menu"
                aria-haspopup="menu"
                aria-expanded={profileMenuOpen}
                title="User profile"
                onClick={() => setProfileMenuOpen((open) => !open)}
              >
                {user.name
                  .split(/\s+/)
                  .map((word) => word[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()}
              </button>
              {profileMenuOpen && (
                <div
                  role="menu"
                  aria-label="User profile options"
                  className="absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-lg border border-slate-100 bg-white py-2 shadow-xl"
                >
                  <p className="px-4 pb-2 text-xs text-muted">
                    Welcome {user.name.split(/\s+/)[0]}!
                  </p>
                  <button
                    role="menuitem"
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      setProfileOpen(true);
                    }}
                  >
                    <span aria-hidden="true">✎</span> Edit Profile
                  </button>
                  <button
                    role="menuitem"
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      void signOut();
                    }}
                  >
                    <span aria-hidden="true">↪</span> Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-[1500px] px-4 py-7 sm:px-7 lg:px-9">
          {actionError && (
            <div
              role="alert"
              className="mb-5 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
            >
              <span>{actionError}</span>
              <button
                className="font-semibold underline"
                onClick={() => setActionError("")}
              >
                Dismiss
              </button>
            </div>
          )}
          {view === "inspection-workflow" ? (
            workflowSelection ? (
              <InspectionWorkflow
                selection={workflowSelection}
                onBack={() => setView(workflowSelection.resource)}
              />
            ) : (
              <Dashboard user={user} onNavigate={setView} />
            )
          ) : view === "dashboard" ? (
            <Dashboard user={user} onNavigate={setView} />
          ) : view === "approvals" ? (
            <Approvals />
          ) : view === "inspections" || view === "quality-checks" ? (
            <InspectionWorkspace
              key={view}
              resource={view}
              user={user}
              onInspect={(selection) => {
                setWorkflowSelection(selection);
                setView("inspection-workflow");
              }}
            />
          ) : (
            <ResourcePage key={view} resource={view} user={user} />
          )}
        </main>
        <footer className="px-7 pb-6 text-center text-xs text-slate-400">
          AutoSureX · Pre-Delivery Inspection
        </footer>
      </div>
      {profileOpen && (
        <ProfileDialog
          user={user}
          onClose={() => setProfileOpen(false)}
          onUpdate={setUser}
        />
      )}
    </div>
  );
}

function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="mb-1 text-xs font-bold uppercase tracking-[.16em] text-brand">
          {eyebrow}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">
          {title}
        </h1>
        <p className="mt-1.5 text-sm text-muted">{description}</p>
      </div>
      {action}
    </div>
  );
}

function Dashboard({
  user,
  onNavigate,
}: {
  user: AuthUser;
  onNavigate: (view: ViewKey) => void;
}) {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [error, setError] = useState("");
  const [seedBusy, setSeedBusy] = useState(false);
  const [seedNotice, setSeedNotice] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api
      .dashboard()
      .then(setMetrics)
      .catch((failure) =>
        setError(
          failure instanceof Error
            ? failure.message
            : "Unable to load dashboard.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);
  const cards = useMemo(
    () =>
      metrics
        ? [
            {
              label: "Active inventory",
              value: metrics.availableListings,
              detail: `${metrics.listings} listings total`,
              icon: "listings",
              color: "brand",
              target: "listings" as ViewKey,
            },
            {
              label: "Sold vehicles",
              value: metrics.soldListings,
              detail: "Listings marked sold",
              icon: "dealers",
              color: "navy",
              target: "listings" as ViewKey,
            },
            {
              label: "Dealers",
              value: metrics.dealers,
              detail: "Registered dealer records",
              icon: "dealers",
              color: "cyan",
              target: "dealers" as ViewKey,
            },
            {
              label: "Buyers",
              value: metrics.buyers,
              detail: "Buyer directory",
              icon: "buyers",
              color: "brand",
              target: "buyers" as ViewKey,
            },
            {
              label: "Sellers",
              value: metrics.sellers,
              detail: "Seller directory",
              icon: "sellers",
              color: "navy",
              target: "sellers" as ViewKey,
            },
            {
              label: "Quick listings",
              value: metrics.quickListings,
              detail: "Customer intake records",
              icon: "quick-listings",
              color: "cyan",
              target: "quick-listings" as ViewKey,
            },
            {
              label: "Open inspections",
              value: metrics.pendingInspections,
              detail: "Awaiting inspection",
              icon: "inspections",
              color: "brand",
              target: "inspections" as ViewKey,
            },
            {
              label: "Quality checks",
              value: metrics.pendingQualityChecks,
              detail: "Awaiting quality review",
              icon: "quality-checks",
              color: "navy",
              target: "quality-checks" as ViewKey,
            },
          ]
        : [],
    [metrics],
  );
  async function loadDemoData() {
    setSeedBusy(true);
    setError("");
    setSeedNotice("");
    try {
      await api.seedDemoData();
      setMetrics(await api.dashboard());
      setSeedNotice("Synthetic test data has been added.");
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Unable to load synthetic test data.",
      );
    } finally {
      setSeedBusy(false);
    }
  }
  return (
    <>
      <section className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-r from-brand-navy via-brand-dark to-brand px-6 py-7 text-white shadow-lg sm:px-8 sm:py-9">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-12 -top-28 h-80 w-80 rounded-full border border-white/10"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-2 -top-16 h-60 w-60 rounded-full border border-white/10"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-28 right-40 h-56 w-56 rounded-full bg-brand-cyan/15 blur-3xl"
        />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.18em] text-sky-100">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-cyan" />
              AutoSureX operations
            </p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Welcome, {user.name.split(" ")[0]}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-sky-100/85 sm:text-base">
              Your inspection operations at a glance. Review activity and keep
              every vehicle moving with confidence.
            </p>
          </div>
          <div className="relative flex flex-wrap items-center gap-2">
            {user.role === "admin" &&
              !loading &&
              metrics &&
              Object.values(metrics).every((value) => value === 0) && (
                <button
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-brand-navy shadow-sm transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={seedBusy}
                  onClick={loadDemoData}
                >
                  {seedBusy ? "Loading demo data…" : "Load demo data"}
                </button>
              )}
            <span className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2.5 text-xs font-semibold capitalize text-white">
              <Icon name="dashboard" size={15} />
              {user.role} workspace
            </span>
          </div>
        </div>
        <div className="relative mt-7 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-white/15 pt-4 text-xs text-sky-100/80">
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-300" />
            Workspace active
          </span>
          <span>
            {new Intl.DateTimeFormat("en", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            }).format(new Date())}
          </span>
        </div>
      </section>
      {seedNotice && (
        <p
          role="status"
          className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700"
        >
          {seedNotice}
        </p>
      )}
      {error && (
        <div
          role="alert"
          className="mb-5 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
        >
          <span>{error}</span>
          <button
            className="font-semibold underline"
            onClick={() => {
              setLoading(true);
              setError("");
              api
                .dashboard()
                .then(setMetrics)
                .catch((failure) => setError(failure.message))
                .finally(() => setLoading(false));
            }}
          >
            Retry
          </button>
        </div>
      )}
      <section
        aria-label="Dashboard metrics"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {loading
          ? Array.from({ length: 8 }, (_, index) => (
              <div
                key={index}
                className="card h-[160px] animate-pulse bg-white p-5"
              >
                <div className="h-3 w-24 rounded bg-slate-100" />
                <div className="mt-6 h-7 w-16 rounded bg-slate-100" />
                <div className="mt-3 h-3 w-32 rounded bg-slate-100" />
              </div>
            ))
          : cards
              .filter(
                (card) =>
                  user.role !== "inspector" ||
                  ["Open inspections", "Quality checks"].includes(card.label),
              )
              .map((card) => (
                <button
                  key={card.label}
                  onClick={() => onNavigate(card.target)}
                  className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 text-left shadow-sm transition duration-200 hover:-translate-y-1 hover:border-brand/30 hover:shadow-lg focus-visible:outline-brand"
                >
                  <div className="flex items-start justify-between">
                    <span className="text-sm font-semibold text-slate-600">
                      {card.label}
                    </span>
                    <span
                      className={`grid h-10 w-10 place-items-center rounded-xl ${card.color === "brand" ? "bg-brand-soft text-brand" : card.color === "cyan" ? "bg-cyan-50 text-cyan-700" : "bg-slate-100 text-brand-navy"}`}
                    >
                      <Icon name={card.icon} size={17} />
                    </span>
                  </div>
                  <p className="mt-4 text-3xl font-bold tracking-tight text-ink">
                    {card.value.toLocaleString()}
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <p className="truncate text-xs text-muted">{card.detail}</p>
                    <span
                      aria-hidden="true"
                      className="text-sm text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand"
                    >
                      →
                    </span>
                  </div>
                  <span
                    aria-hidden="true"
                    className={`absolute bottom-0 left-0 h-1 w-full origin-left scale-x-0 transition-transform duration-200 group-hover:scale-x-100 ${card.color === "cyan" ? "bg-brand-cyan" : card.color === "navy" ? "bg-brand-navy" : "bg-brand"}`}
                  />
                </button>
              ))}
      </section>
      {user.role === "admin" && metrics && (
        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-base font-semibold text-ink">
                  Inventory overview
                </p>
                <p className="mt-1 text-xs text-muted">
                  Current listing availability
                </p>
              </div>
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand">
                <Icon name="listings" />
              </span>
            </div>
            <div className="mt-6 flex items-end justify-between gap-3">
              <div>
                <p className="text-3xl font-bold tracking-tight text-ink">
                  {metrics.availableListings.toLocaleString()}
                  <span className="ml-1 text-base font-medium text-muted">
                    / {metrics.listings.toLocaleString()}
                  </span>
                </p>
                <p className="mt-1 text-xs text-muted">vehicles available</p>
              </div>
              <button
                className="text-xs font-semibold text-brand hover:text-brand-dark"
                onClick={() => onNavigate("listings")}
              >
                View inventory →
              </button>
            </div>
            <div
              className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"
              role="progressbar"
              aria-label="Available inventory"
              aria-valuemin={0}
              aria-valuemax={metrics.listings}
              aria-valuenow={metrics.availableListings}
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand to-brand-cyan transition-all"
                style={{
                  width: `${metrics.listings ? Math.min(100, (metrics.availableListings / metrics.listings) * 100) : 0}%`,
                }}
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted">
              <span>
                <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-brand" />
                {metrics.availableListings} available
              </span>
              <span>
                <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-slate-300" />
                {Math.max(0, metrics.listings - metrics.availableListings)} other
                listings
              </span>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-base font-semibold text-ink">
                  Team review queue
                </p>
                <p className="mt-1 text-xs text-muted">
                  Work items needing attention
                </p>
              </div>
              <span className="rounded-full bg-brand-soft px-3 py-1.5 text-xs font-bold text-brand">
                {metrics.pendingApprovals} approvals
              </span>
            </div>
            <div className="mt-5 space-y-3">
              <button
                className="flex w-full items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-left transition hover:border-brand/20 hover:bg-brand-soft/50"
                onClick={() => onNavigate("inspections")}
              >
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-white text-brand shadow-sm">
                  <Icon name="inspections" size={17} />
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-semibold text-ink">
                    Inspections
                  </span>
                  <span className="text-xs text-muted">Awaiting inspection</span>
                </span>
                <span className="text-lg font-bold text-ink">
                  {metrics.pendingInspections}
                </span>
                <span className="text-slate-400">→</span>
              </button>
              <button
                className="flex w-full items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-left transition hover:border-brand/20 hover:bg-brand-soft/50"
                onClick={() => onNavigate("quality-checks")}
              >
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-white text-brand shadow-sm">
                  <Icon name="quality-checks" size={17} />
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-semibold text-ink">
                    Quality checks
                  </span>
                  <span className="text-xs text-muted">Awaiting quality review</span>
                </span>
                <span className="text-lg font-bold text-ink">
                  {metrics.pendingQualityChecks}
                </span>
                <span className="text-slate-400">→</span>
              </button>
            </div>
            <button
              className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-brand hover:text-brand-dark"
              onClick={() => onNavigate("approvals")}
            >
              Review {metrics.pendingApprovals} pending approvals
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </section>
      )}
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {[
          {
            title: "Manage inventory",
            copy: "Create, update, and review vehicle listings.",
            icon: "listings",
            target: "listings" as ViewKey,
          },
          {
            title: "Schedule inspections",
            copy: "Coordinate quick-listing appointments and assignments.",
            icon: "inspections",
            target: "inspections" as ViewKey,
          },
          {
            title: "Customer directories",
            copy: "Keep buyer and seller records up to date.",
            icon: "buyers",
            target: "buyers" as ViewKey,
          },
        ]
          .filter(
            (item) =>
              user.role !== "inspector" || item.target === "inspections",
          )
          .map((item) => (
            <button
              key={item.title}
              onClick={() => onNavigate(item.target)}
              className="card flex items-center gap-4 p-5 text-left transition hover:border-brand/30"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                <Icon name={item.icon} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink">
                  {item.title}
                </span>
                <span className="mt-1 block text-xs leading-5 text-muted">
                  {item.copy}
                </span>
              </span>
              <span className="text-slate-400">→</span>
            </button>
          ))}
      </div>
    </>
  );
}

function ResourcePage({
  resource,
  user,
}: {
  resource: ResourceName;
  user: AuthUser;
}) {
  const definition = resources[resource];
  const [records, setRecords] = useState<RecordPage | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("created_at");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const pageSize = 10;
  const [refreshKey, setRefreshKey] = useState(0);
  const [loadedKey, setLoadedKey] = useState("");
  const requestKey = JSON.stringify([
    resource,
    query,
    page,
    pageSize,
    sort,
    direction,
    status,
    refreshKey,
  ]);
  const busy = loadedKey !== requestKey;
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState<
    | { mode: "create" }
    | { mode: "edit"; record: Record<string, unknown> }
    | { mode: "status"; record: Record<string, unknown> }
    | null
  >(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    let active = true;
    void api
      .list(resource, {
        q: query,
        page,
        pageSize,
        sort,
        direction,
        status,
      })
      .then((result) => {
        if (active) {
          setRecords(result);
          setError("");
        }
      })
      .catch((failure: unknown) => {
        if (active) {
          setError(
            failure instanceof Error
              ? failure.message
              : "Unable to load records.",
          );
        }
      })
      .finally(() => {
        if (active) setLoadedKey(requestKey);
      });
    return () => {
      active = false;
    };
  }, [
    resource,
    query,
    page,
    pageSize,
    sort,
    direction,
    status,
    refreshKey,
    requestKey,
  ]);
  const load = () => setRefreshKey((key) => key + 1);
  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3500);
  };
  const writeAccess =
    user.role !== "inspector" ||
    ["inspections", "quality-checks"].includes(resource);
  const createAccess = user.role !== "inspector";
  const canDelete = user.role === "admin";

  async function save(data: Record<string, unknown>, id?: number) {
    if (id) await api.update(resource, id, data);
    else await api.create(resource, data);
    setDialog(null);
    notify(
      `${definition.singular[0].toUpperCase()}${definition.singular.slice(1)} ${id ? "updated" : "created"}.`,
    );
    load();
  }

  async function remove(record: Record<string, unknown>) {
    const label = String(
      record.registration_no ?? record.name ?? `#${record.id}`,
    );
    if (!window.confirm(`Delete ${label}? This action cannot be undone.`))
      return;
    try {
      await api.remove(resource, Number(record.id));
      notify("Record deleted.");
      load();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Unable to delete this record.",
      );
    }
  }

  function changeSort(key: string) {
    setDirection((previous) =>
      sort === key && previous === "asc" ? "desc" : "asc",
    );
    setSort(key);
    setPage(1);
  }

  const columnDefs = definition.columns.map((key) => ({
    key,
    label: key
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase()),
  }));
  return (
    <>
      <PageHeading
        eyebrow={
          resource === "inspections" ||
          resource === "quality-checks" ||
          resource === "repairs"
            ? "Operations"
            : "Management"
        }
        title={definition.name}
        description={definition.description}
        action={
          createAccess ? (
            <button
              className="btn-primary"
              onClick={() => setDialog({ mode: "create" })}
            >
              <span aria-hidden="true">＋</span> Add {definition.singular}
            </button>
          ) : undefined
        }
      />
      {toast && (
        <div
          role="status"
          className="fixed right-5 top-20 z-50 rounded-xl bg-ink px-4 py-3 text-sm text-white shadow-lg"
        >
          {toast}
        </div>
      )}
      <section className="card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <h2 className="text-sm font-semibold text-ink">
              {definition.name}{" "}
              <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                {records?.total ?? "—"}
              </span>
            </h2>
            <p className="mt-1 text-xs text-muted">
              Search, filter, and manage records.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            {definition.filterStatus && (
              <label className="sr-only" htmlFor="status-filter">
                Filter by status
              </label>
            )}
            {definition.filterStatus && (
              <select
                id="status-filter"
                className="field-control min-w-[150px] py-2"
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">All statuses</option>
                {definition.filterStatus.map((value) => (
                  <option key={value} value={value}>
                    {value.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            )}
            <div className="relative">
              <label className="sr-only" htmlFor="record-search">
                Search records
              </label>
              <span className="pointer-events-none absolute left-3 top-2.5 text-slate-400">
                ⌕
              </span>
              <input
                id="record-search"
                className="field-control min-w-[210px] py-2 pl-9"
                type="search"
                value={query}
                placeholder="Search records…"
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>
        </div>
        {error && (
          <div
            role="alert"
            className="m-4 flex items-center justify-between rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"
          >
            <span>{error}</span>
            <button className="font-semibold underline" onClick={load}>
              Retry
            </button>
          </div>
        )}
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead className="bg-slate-50/80">
              <tr>
                {columnDefs.map((column) => (
                  <th
                    key={column.key}
                    className="px-4 py-3 text-[10px] font-bold uppercase tracking-[.12em] text-slate-500"
                  >
                    <button
                      className="flex items-center gap-1 hover:text-brand"
                      onClick={() => changeSort(column.key)}
                    >
                      {column.label}
                      <span className="text-slate-300">
                        {sort === column.key
                          ? direction === "asc"
                            ? "↑"
                            : "↓"
                          : "↕"}
                      </span>
                    </button>
                  </th>
                ))}
                <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-[.12em] text-slate-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {busy &&
                Array.from({ length: 5 }, (_, index) => (
                  <tr key={`skeleton-${index}`}>
                    <td className="px-4 py-4" colSpan={columnDefs.length + 1}>
                      <div className="h-4 animate-pulse rounded bg-slate-100" />
                    </td>
                  </tr>
                ))}
              {!busy &&
                records?.data.map((record) => (
                  <tr
                    key={String(record.id)}
                    className="transition hover:bg-slate-50/70"
                  >
                    {columnDefs.map((column) => (
                      <td
                        key={column.key}
                        className="table-cell max-w-[260px] truncate"
                      >
                        {column.key === definition.statusKey ||
                        column.key === "status" ||
                        column.key === "inspection_status" ? (
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${statusClass(record[column.key])}`}
                          >
                            {String(record[column.key] ?? "—").replaceAll(
                              "_",
                              " ",
                            )}
                          </span>
                        ) : column.key === "assigned_to" ? (
                          <span>
                            {String(record.assigned_to_name ?? "Unassigned")}
                          </span>
                        ) : column.key === "price" ? (
                          <span className="font-semibold text-ink">
                            {formatValue(record[column.key], column.key)}
                          </span>
                        ) : (
                          formatValue(record[column.key], column.key)
                        )}
                      </td>
                    ))}
                    <td className="table-cell text-right">
                      <div className="flex justify-end gap-1.5">
                        {[
                          "inspections",
                          "quality-checks",
                          "quick-listings",
                        ].includes(resource) && (
                          <button
                            className="rounded-md px-2.5 py-1.5 text-xs font-semibold text-brand hover:bg-brand-soft"
                            onClick={() =>
                              setDialog({ mode: "status", record })
                            }
                          >
                            Request status
                          </button>
                        )}
                        {writeAccess && (
                          <button
                            className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-brand"
                            aria-label={`Edit ${definition.singular}`}
                            title="Edit"
                            onClick={() => setDialog({ mode: "edit", record })}
                          >
                            ✎
                          </button>
                        )}
                        {canDelete && (
                          <button
                            className="rounded-md p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                            aria-label={`Delete ${definition.singular}`}
                            title="Delete"
                            onClick={() => void remove(record)}
                          >
                            ⌫
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              {!busy && !records?.data.length && (
                <tr>
                  <td
                    colSpan={columnDefs.length + 1}
                    className="px-6 py-16 text-center"
                  >
                    <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-xl text-slate-400">
                      ⌕
                    </span>
                    <p className="mt-3 text-sm font-semibold text-ink">
                      {query || status
                        ? "No matching records"
                        : "No records yet"}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {query || status
                        ? "Try another search or clear your filters."
                        : createAccess
                          ? `Add your first ${definition.singular} to get started.`
                          : "Records will appear here when they are assigned to you."}
                    </p>
                    {!query && !status && createAccess && (
                      <button
                        className="btn-primary mt-4"
                        onClick={() => setDialog({ mode: "create" })}
                      >
                        Add your first {definition.singular}
                      </button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t border-line px-4 py-3.5 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p>
            {records?.total
              ? `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, records.total)} of ${records.total}`
              : "Showing 0 records"}
          </p>
          <div className="flex items-center gap-2">
            <button
              className="btn-secondary !px-3 !py-1.5 text-xs"
              disabled={page <= 1 || busy}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
            >
              Previous
            </button>
            <span>
              Page {page} of{" "}
              {Math.max(1, Math.ceil((records?.total ?? 0) / pageSize))}
            </span>
            <button
              className="btn-secondary !px-3 !py-1.5 text-xs"
              disabled={
                page >= Math.ceil((records?.total ?? 0) / pageSize) || busy
              }
              onClick={() => setPage((value) => value + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </section>
      {dialog?.mode === "create" && (
        <RecordDialog
          definition={definition}
          user={user}
          onClose={() => setDialog(null)}
          onSave={(data) => save(data)}
        />
      )}
      {dialog?.mode === "edit" && (
        <RecordDialog
          definition={definition}
          user={user}
          record={dialog.record}
          onClose={() => setDialog(null)}
          onSave={(data) => save(data, Number(dialog.record.id))}
        />
      )}
      {dialog?.mode === "status" && (
        <StatusDialog
          resource={resource}
          record={dialog.record}
          currentStatus={String(
            dialog.record[definition.statusKey ?? "status"] ?? "",
          )}
          allowed={definition.filterStatus ?? []}
          onClose={() => setDialog(null)}
          onSave={async (next, note) => {
            await api.requestStatus(
              resource,
              Number(dialog.record.id),
              next,
              note,
            );
            setDialog(null);
            notify("Status change submitted for administrator approval.");
            load();
          }}
        />
      )}
    </>
  );
}

function RecordDialog({
  definition,
  user,
  record,
  onClose,
  onSave,
}: {
  definition: ResourceDefinition;
  user: AuthUser;
  record?: Record<string, unknown>;
  onClose: () => void;
  onSave: (data: Record<string, unknown>) => Promise<void>;
}) {
  const fields =
    user.role === "inspector"
      ? definition.fields.filter(
          (field) => field.key === "notes" || field.key === "findings",
        )
      : definition.fields;
  const [inspectors, setInspectors] = useState<{ id: number; name: string }[]>(
    [],
  );
  const needsStaff = fields.some((field) => field.key === "assigned_to");
  const [loadingStaff, setLoadingStaff] = useState(needsStaff);
  const [values, setValues] = useState<Record<string, string | boolean>>(() => {
    const initial: Record<string, string | boolean> = {};
    fields.forEach((field) => {
      const original = record?.[field.key];
      if (field.type === "checkbox") initial[field.key] = Boolean(original);
      else if (field.key === "features" && Array.isArray(original))
        initial[field.key] = original.join(", ");
      else if (original !== undefined && original !== null) {
        const value = String(original);
        initial[field.key] =
          field.type === "datetime-local" && value
            ? value.slice(0, 16)
            : value.slice(0, 10) && field.type === "date"
              ? value.slice(0, 10)
              : value;
      } else if (
        field.key === "registered_at" ||
        field.key === "registration_date" ||
        field.key === "scheduled_date"
      )
        initial[field.key] = new Date().toISOString().slice(0, 10);
      else if (field.key === "model_year")
        initial[field.key] = String(new Date().getFullYear());
      else if (field.key === "status")
        initial[field.key] = field.options?.[0] ?? "";
      else if (field.key === "inspection_status")
        initial[field.key] = "pending";
      else initial[field.key] = "";
    });
    return initial;
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!needsStaff) return;
    api
      .staff()
      .then(({ data }) => setInspectors(data))
      .catch((failure) =>
        setError(
          failure instanceof Error
            ? failure.message
            : "Unable to load inspection staff.",
        ),
      )
      .finally(() => setLoadingStaff(false));
  }, [needsStaff]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const data: Record<string, unknown> = {};
    fields.forEach((field) => {
      const value = values[field.key];
      if (field.type === "checkbox") data[field.key] = Boolean(value);
      else if (field.key === "features")
        data[field.key] = String(value ?? "")
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean);
      else if (field.key === "assigned_to")
        data[field.key] = value ? Number(value) : null;
      else if (typeof value === "string" && value.trim() !== "") {
        if (field.type === "number") data[field.key] = Number(value);
        else if (field.type === "datetime-local")
          data[field.key] = new Date(value).toISOString();
        else data[field.key] = value.trim();
      } else if (field.type === "number" && !field.required)
        data[field.key] = null;
      else if (
        !field.required &&
        [
          "seller_id",
          "appointment_at",
          "scheduled_at",
          "insurance_expiry",
        ].includes(field.key)
      )
        data[field.key] = null;
    });
    try {
      await onSave(data);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Unable to save this record.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={`${record ? "Edit" : "Add"} ${definition.singular}`}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="grid max-h-[65vh] grid-cols-1 gap-4 overflow-y-auto px-5 py-5 sm:grid-cols-2">
          {fields.map((field) => (
            <FormField
              key={field.key}
              field={field}
              value={values[field.key] ?? ""}
              inspectors={inspectors}
              onChange={(value) =>
                setValues((previous) => ({ ...previous, [field.key]: value }))
              }
            />
          ))}
        </div>
        {error && (
          <div
            role="alert"
            className="mx-5 mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700"
          >
            {error}
          </div>
        )}
        <div className="flex justify-end gap-2 border-t border-line bg-slate-50/70 px-5 py-4">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" disabled={busy || loadingStaff}>
            {busy
              ? "Saving…"
              : record
                ? "Save changes"
                : `Create ${definition.singular}`}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function FormField({
  field,
  value,
  inspectors = [],
  onChange,
}: {
  field: FieldDefinition;
  value: string | boolean;
  inspectors?: { id: number; name: string }[];
  onChange: (value: string | boolean) => void;
}) {
  const id = `field-${field.key}`;
  if (field.type === "checkbox")
    return (
      <label
        className={`flex items-center gap-2.5 rounded-lg border border-line px-3 py-3 text-sm font-medium text-slate-700 ${field.wide ? "sm:col-span-2" : ""}`}
      >
        <input
          id={id}
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
          className="h-4 w-4 rounded border-slate-300 accent-brand"
        />
        {field.label}
      </label>
    );
  return (
    <div className={field.wide ? "sm:col-span-2" : ""}>
      <label className="field-label" htmlFor={id}>
        {field.label}
        {field.required && <span className="ml-1 text-rose-500">*</span>}
      </label>
      {field.type === "textarea" ? (
        <textarea
          id={id}
          className="field-control min-h-24 resize-y"
          required={field.required}
          value={String(value)}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : field.type === "select" ? (
        <select
          id={id}
          className="field-control"
          required={field.required}
          value={String(value)}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">Select {field.label.toLowerCase()}</option>
          {field.key === "assigned_to"
            ? inspectors.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))
            : field.options?.map((option) => (
                <option key={option} value={option}>
                  {option.replaceAll("_", " ")}
                </option>
              ))}
        </select>
      ) : (
        <input
          id={id}
          className="field-control"
          type={field.type ?? "text"}
          required={field.required}
          value={String(value)}
          onChange={(event) => onChange(event.target.value)}
          step={field.type === "number" ? "any" : undefined}
        />
      )}
    </div>
  );
}

function StatusDialog({
  resource,
  record,
  currentStatus,
  allowed,
  onClose,
  onSave,
}: {
  resource: ResourceName;
  record: Record<string, unknown>;
  currentStatus: string;
  allowed: string[];
  onClose: () => void;
  onSave: (status: string, note: string) => Promise<void>;
}) {
  const [status, setStatus] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!status) return;
    setBusy(true);
    setError("");
    try {
      await onSave(status, note);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Unable to submit status request.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Request a status change" onClose={onClose}>
      <form onSubmit={submit} className="p-5">
        <p className="mb-4 text-sm leading-6 text-muted">
          This request is sent to an administrator for approval. The record
          remains{" "}
          <strong className="font-semibold capitalize text-ink">
            {currentStatus.replaceAll("_", " ")}
          </strong>{" "}
          until approved.
        </p>
        <div className="space-y-4">
          <div>
            <label className="field-label" htmlFor="next-status">
              Requested status
            </label>
            <select
              id="next-status"
              className="field-control"
              required
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">Choose a status</option>
              {allowed
                .filter((value) => value !== currentStatus)
                .map((value) => (
                  <option key={value} value={value}>
                    {value.replaceAll("_", " ")}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="request-note">
              Note (optional)
            </label>
            <textarea
              id="request-note"
              className="field-control min-h-20"
              maxLength={500}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
        </div>
        {error && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700"
          >
            {error}
          </div>
        )}
        <div className="mt-5 flex justify-end gap-2 border-t border-line pt-4">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" disabled={busy || !status}>
            {busy ? "Submitting…" : "Submit for approval"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Approvals() {
  const [requests, setRequests] = useState<StatusRequest[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loadedKey, setLoadedKey] = useState<number | null>(null);
  const loading = loadedKey !== refreshKey;
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [toast, setToast] = useState("");
  useEffect(() => {
    let active = true;
    void api
      .statusRequests()
      .then(({ data }) => {
        if (active) {
          setRequests(data);
          setError("");
        }
      })
      .catch((failure: unknown) => {
        if (active) {
          setError(
            failure instanceof Error
              ? failure.message
              : "Unable to load approvals.",
          );
        }
      })
      .finally(() => {
        if (active) setLoadedKey(refreshKey);
      });
    return () => {
      active = false;
    };
  }, [refreshKey]);
  const load = () => setRefreshKey((key) => key + 1);
  async function review(
    item: StatusRequest,
    decision: "approved" | "rejected",
  ) {
    setBusyId(item.id);
    setError("");
    try {
      await api.reviewStatus(item.id, decision);
      setToast(`Status request ${decision}.`);
      window.setTimeout(() => setToast(""), 3000);
      load();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Unable to review this request.",
      );
    } finally {
      setBusyId(null);
    }
  }
  const pending = requests.filter((item) => item.status === "pending");
  return (
    <>
      <PageHeading
        eyebrow="Governance"
        title="Status approvals"
        description="Review inspection and quality status requests before the workflow changes."
        action={
          <button className="btn-secondary" onClick={load}>
            ↻ Refresh
          </button>
        }
      />
      {toast && (
        <div
          role="status"
          className="fixed right-5 top-20 z-50 rounded-xl bg-ink px-4 py-3 text-sm text-white shadow-lg"
        >
          {toast}
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
        >
          {error}
        </div>
      )}
      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-ink">Review queue</h2>
            <p className="mt-1 text-xs text-muted">
              {pending.length} request{pending.length === 1 ? "" : "s"} need
              attention
            </p>
          </div>
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
            {pending.length} pending
          </span>
        </div>
        {loading ? (
          <div className="space-y-3 p-5" role="status">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-16 animate-pulse rounded-lg bg-slate-100"
              />
            ))}
          </div>
        ) : !requests.length ? (
          <div className="px-5 py-16 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-xl text-emerald-600">
              ✓
            </span>
            <p className="mt-3 text-sm font-semibold text-ink">All clear</p>
            <p className="mt-1 text-xs text-muted">
              There are no status change requests to review.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {requests.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center"
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                  <Icon name={item.resource} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold capitalize text-ink">
                      {item.resource.replaceAll("-", " ")}{" "}
                      <span className="font-normal text-muted">
                        #{item.resourceId}
                      </span>
                    </p>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize ${statusClass(item.status)}`}
                    >
                      {item.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    Requested by {item.requestedBy} ·{" "}
                    {new Date(item.requestedAt).toLocaleString()}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    <span className="capitalize">
                      {item.fromStatus.replaceAll("_", " ")}
                    </span>
                    <span className="mx-2 text-slate-300">→</span>
                    <span className="font-semibold capitalize text-ink">
                      {item.toStatus.replaceAll("_", " ")}
                    </span>
                    {item.note && (
                      <span className="ml-2 text-xs text-muted">
                        “{item.note}”
                      </span>
                    )}
                  </p>
                </div>
                {item.status === "pending" && (
                  <div className="flex shrink-0 gap-2">
                    <button
                      className="btn-secondary !px-3 !py-2 text-xs"
                      disabled={busyId === item.id}
                      onClick={() => void review(item, "rejected")}
                    >
                      Reject
                    </button>
                    <button
                      className="btn-primary !px-3 !py-2 text-xs"
                      disabled={busyId === item.id}
                      onClick={() => void review(item, "approved")}
                    >
                      {busyId === item.id ? "Saving…" : "Approve"}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function ProfileDialog({
  user,
  onClose,
  onUpdate,
}: {
  user: AuthUser;
  onClose: () => void;
  onUpdate: (user: AuthUser) => void;
}) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (newPassword && !currentPassword) {
      setError("Enter your current password to set a new one.");
      return;
    }
    if (newPassword && newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }
    setBusy(true);
    try {
      const result = await api.updateProfile({
        name,
        email,
        ...(currentPassword && newPassword
          ? { currentPassword, newPassword }
          : {}),
      });
      onUpdate(result.user);
      onClose();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Unable to update your profile.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Edit Profile" onClose={onClose}>
      <form onSubmit={submit} className="p-5">
        <div className="space-y-4">
          <div>
            <label className="field-label" htmlFor="profile-name">
              Display name
            </label>
            <input
              id="profile-name"
              className="field-control"
              required
              maxLength={120}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="profile-email">
              Email address
            </label>
            <input
              id="profile-email"
              className="field-control"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="border-t border-line pt-4">
            <p className="text-sm font-semibold text-ink">Change password</p>
            <p className="mt-1 text-xs text-muted">
              Leave these fields blank to keep your current password.
            </p>
          </div>
          <div>
            <label className="field-label" htmlFor="profile-current-password">
              Current password
            </label>
            <input
              id="profile-current-password"
              className="field-control"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="profile-new-password">
              New password
            </label>
            <input
              id="profile-new-password"
              className="field-control"
              type="password"
              autoComplete="new-password"
              minLength={12}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="profile-confirm-password">
              Confirm new password
            </label>
            <input
              id="profile-confirm-password"
              className="field-control"
              type="password"
              autoComplete="new-password"
              minLength={12}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </div>
        </div>
        {error && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700"
          >
            {error}
          </div>
        )}
        <div className="mt-5 flex justify-end gap-2 border-t border-line pt-4">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Save profile"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const dialog = dialogRef.current;
    const focusable = () =>
      dialog?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      );
    focusable()?.[0]?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") closeRef.current();
      if (event.key === "Tab") {
        const items = focusable();
        if (!items?.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previousFocus?.focus();
    };
  }, []);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-3 sm:p-6"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 id="dialog-title" className="text-lg font-semibold text-ink">
            {title}
          </h2>
          <button
            aria-label="Close dialog"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-ink"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

export default App;
