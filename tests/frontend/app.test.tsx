import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../src/App";
import { api } from "../../src/api";
import { ApiRequestError } from "../../src/api-errors";

vi.mock("../../src/api", () => ({
  api: {
    me: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    dashboard: vi.fn(),
    seedDemoData: vi.fn(),
    staff: vi.fn(),
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    statusRequests: vi.fn(),
    requestStatus: vi.fn(),
    reviewStatus: vi.fn(),
  },
}));

describe("admin application interactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.me).mockRejectedValue(
      new ApiRequestError("Sign in to continue.", 401, "UNAUTHENTICATED"),
    );
    vi.mocked(api.dashboard).mockResolvedValue({
      listings: 0,
      soldListings: 0,
      availableListings: 0,
      dealers: 0,
      buyers: 0,
      sellers: 0,
      quickListings: 0,
      repairs: 0,
      pendingInspections: 0,
      pendingQualityChecks: 0,
      pendingApprovals: 0,
    });
    vi.mocked(api.list).mockResolvedValue({
      data: [],
      page: 1,
      pageSize: 10,
      total: 0,
    });
  });

  it("signs in and displays persisted dashboard metrics", async () => {
    const user = userEvent.setup();
    vi.mocked(api.login).mockResolvedValue({
      user: {
        id: 1,
        name: "Demo Administrator",
        email: "admin@example.test",
        role: "admin",
      },
      csrfToken: "synthetic-token",
      sessionToken: "a".repeat(64),
    });
    vi.mocked(api.dashboard).mockResolvedValue({
      listings: 12,
      soldListings: 3,
      availableListings: 9,
      dealers: 2,
      buyers: 4,
      sellers: 1,
      quickListings: 5,
      repairs: 1,
      pendingInspections: 2,
      pendingQualityChecks: 1,
      pendingApprovals: 0,
    });
    render(<App />);

    await user.type(
      await screen.findByLabelText("Email address"),
      "admin@example.test",
    );
    await user.type(
      screen.getByLabelText("Password"),
      "synthetic-test-password",
    );
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(
      await screen.findByRole("heading", { name: "Welcome, Demo" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Active inventory")).toBeInTheDocument();
    expect(screen.getByText("9", { selector: "p" })).toBeInTheDocument();
  });

  it("creates a dealer through the accessible record form", async () => {
    const user = userEvent.setup();
    vi.mocked(api.login).mockResolvedValue({
      user: {
        id: 1,
        name: "Demo Administrator",
        email: "admin@example.test",
        role: "admin",
      },
      csrfToken: "synthetic-token",
      sessionToken: "a".repeat(64),
    });
    vi.mocked(api.create).mockResolvedValue({ id: 4 });
    render(<App />);
    await user.type(
      await screen.findByLabelText("Email address"),
      "admin@example.test",
    );
    await user.type(
      screen.getByLabelText("Password"),
      "synthetic-test-password",
    );
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    await screen.findByRole("heading", { name: "Welcome, Demo" });

    const navigation = screen.getByRole("navigation", {
      name: "Main navigation",
    });
    await user.click(
      within(navigation).getByRole("button", { name: "Dealers" }),
    );
    await screen.findByRole("heading", { name: "Dealers", level: 1 });
    await user.click(screen.getByRole("button", { name: /add dealer/i }));
    const dialog = screen.getByRole("dialog");
    await user.type(
      within(dialog).getByLabelText(/dealer name/i),
      "Test Dealer",
    );
    await user.type(
      within(dialog).getByLabelText(/email address/i),
      "dealer@example.test",
    );
    await user.type(
      within(dialog).getByLabelText(/contact number/i),
      "+91 90000 00001",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Create dealer" }),
    );

    await waitFor(() =>
      expect(api.create).toHaveBeenCalledWith("dealers", {
        name: "Test Dealer",
        email: "dealer@example.test",
        contact_no: "+91 90000 00001",
      }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Dealer created.",
    );
  });

  it("lets an administrator seed demo data when the workspace is empty", async () => {
    const user = userEvent.setup();
    vi.mocked(api.login).mockResolvedValue({
      user: {
        id: 1,
        name: "Demo Administrator",
        email: "admin@example.test",
        role: "admin",
      },
      csrfToken: "synthetic-token",
      sessionToken: "a".repeat(64),
    });
    vi.mocked(api.seedDemoData).mockResolvedValue({
      message: "Synthetic demo data is ready.",
    });
    vi.mocked(api.dashboard)
      .mockResolvedValueOnce({
        listings: 0,
        soldListings: 0,
        availableListings: 0,
        dealers: 0,
        buyers: 0,
        sellers: 0,
        quickListings: 0,
        repairs: 0,
        pendingInspections: 0,
        pendingQualityChecks: 0,
        pendingApprovals: 0,
      })
      .mockResolvedValueOnce({
        listings: 5,
        soldListings: 1,
        availableListings: 2,
        dealers: 5,
        buyers: 5,
        sellers: 5,
        quickListings: 5,
        repairs: 5,
        pendingInspections: 2,
        pendingQualityChecks: 2,
        pendingApprovals: 2,
      });
    render(<App />);

    await user.type(
      await screen.findByLabelText("Email address"),
      "admin@example.test",
    );
    await user.type(
      screen.getByLabelText("Password"),
      "synthetic-test-password",
    );
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    await screen.findByRole("heading", { name: "Welcome, Demo" });
    await user.click(
      await screen.findByRole("button", { name: "Load demo data" }),
    );

    expect(api.seedDemoData).toHaveBeenCalledOnce();
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Synthetic test data has been added.",
    );
    expect(await screen.findByText("5 listings total")).toBeInTheDocument();
  });

  it("reports authentication failures without losing entered values", async () => {
    const user = userEvent.setup();
    vi.mocked(api.login).mockRejectedValue(
      new Error("Email or password is incorrect."),
    );
    render(<App />);
    const email = await screen.findByLabelText("Email address");
    await user.type(email, "admin@example.test");
    await user.type(
      screen.getByLabelText("Password"),
      "incorrect-synthetic-password",
    );
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Email or password is incorrect.",
    );
    expect(email).toHaveValue("admin@example.test");
  });
});
