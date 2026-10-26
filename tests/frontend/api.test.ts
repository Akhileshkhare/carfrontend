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
  });

  it("confirms the cookie-backed session before completing login", async () => {
    const user = {
      id: 1,
      name: "Demo Administrator",
      email: "admin@example.test",
      role: "admin" as const,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, { user, csrfToken: "login-csrf-token" }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, { user, csrfToken: "verified-csrf-token" }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      api.login("admin@example.test", "synthetic-password"),
    ).resolves.toEqual({ user, csrfToken: "verified-csrf-token" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: "POST",
      credentials: "include",
    });
    expect(fetchMock.mock.calls[1][0]).toContain("/auth/me");
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      method: "GET",
      credentials: "include",
    });
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
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(401, {
          error: {
            code: "UNAUTHENTICATED",
            message: "Sign in to continue.",
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
    });
  });
});
