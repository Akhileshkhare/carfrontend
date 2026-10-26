import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../../src/api";

function jsonResponse(status: number, body: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as Response;
}

describe("API authentication", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.sessionStorage.clear();
  });

  it("completes login from the authenticated response without a cookie check", async () => {
    const user = {
      id: 1,
      name: "Demo Administrator",
      email: "admin@example.test",
      role: "admin" as const,
    };
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse(200, {
        user,
        csrfToken: "login-csrf-token",
        sessionToken: "a".repeat(64),
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      api.login("admin@example.test", "synthetic-password"),
    ).resolves.toEqual({
      user,
      csrfToken: "login-csrf-token",
      sessionToken: "a".repeat(64),
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: "POST",
      credentials: "include",
      cache: "no-store",
    });
    expect(window.sessionStorage.getItem("cc_session_token")).toBe("a".repeat(64));
  });

  it("does not complete login when the browser did not retain the session", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse(401, {
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Email or password is incorrect.",
          requestId: "login-session-check-123",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      api.login("admin@example.test", "synthetic-password"),
    ).rejects.toMatchObject({
      message: "Email or password is incorrect.",
      status: 401,
      code: "INVALID_CREDENTIALS",
      requestId: "login-session-check-123",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("sends the login session token on dashboard requests", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, {
          user: {
            id: 1,
            name: "Demo Administrator",
            email: "admin@example.test",
            role: "admin",
          },
          csrfToken: "login-csrf-token",
          sessionToken: "b".repeat(64),
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
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
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await api.login("admin@example.test", "synthetic-password");
    await expect(api.dashboard()).resolves.toMatchObject({
      listings: 5,
      dealers: 5,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(
      new Headers(fetchMock.mock.calls[1][1]?.headers).get("Authorization"),
    ).toBe(`Bearer ${"b".repeat(64)}`);
  });
});
