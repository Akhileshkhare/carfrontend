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

  it("confirms the bearer-backed session before completing login", async () => {
    const user = {
      id: 1,
      name: "Demo Administrator",
      email: "admin@example.test",
      role: "admin" as const,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, {
          user,
          csrfToken: "login-csrf-token",
          sessionToken: "a".repeat(64),
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          user,
          csrfToken: "verified-csrf-token",
          sessionToken: "a".repeat(64),
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      api.login("admin@example.test", "synthetic-password"),
    ).resolves.toEqual({
      user,
      csrfToken: "verified-csrf-token",
      sessionToken: "a".repeat(64),
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: "POST",
      credentials: "include",
      cache: "no-store",
    });
    expect(fetchMock.mock.calls[1][0]).toContain("/auth/me");
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });
    expect(
      new Headers(fetchMock.mock.calls[1][1]?.headers).get("Authorization"),
    ).toBe(`Bearer ${"a".repeat(64)}`);
    expect(window.sessionStorage.getItem("cc_session_token")).toBe("a".repeat(64));
  });

  it("does not complete login when the browser did not retain the session", async () => {
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
          sessionToken: "a".repeat(64),
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(401, {
          error: {
            code: "UNAUTHENTICATED",
            message: "Sign in to continue.",
            requestId: "login-session-check-123",
          },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      api.login("admin@example.test", "synthetic-password"),
    ).rejects.toMatchObject({
      message: "Sign in to continue.",
      status: 401,
      code: "UNAUTHENTICATED",
      requestId: "login-session-check-123",
    });
  });
});
