import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWebsiteText, normalizeUrl, toggleWwwPrefix } from "@/server/ai/website-fetch";

function mockFetchOnce(response: Partial<Response> & { text?: () => Promise<string> }) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "text/html" }),
      text: async () => "",
      ...response,
    } as Response)
  );
}

describe("fetchWebsiteText", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null when the response is not ok", async () => {
    mockFetchOnce({ ok: false });
    expect(await fetchWebsiteText("https://example.com")).toBeNull();
  });

  it("returns null when the content type is not HTML", async () => {
    mockFetchOnce({ headers: new Headers({ "content-type": "application/json" }) });
    expect(await fetchWebsiteText("https://example.com")).toBeNull();
  });

  it("strips tags, scripts and styles and collapses whitespace", async () => {
    const html = `<html><head><style>body{color:red}</style><script>alert(1)</script></head>
      <body><h1>Camaleonic   Survey</h1><p>Encuestas   con   IA para escuchar a tus clientes, empleados y proveedores.</p><!-- comment --></body></html>`;
    mockFetchOnce({ text: async () => html });
    const text = await fetchWebsiteText("https://example.com");
    expect(text).toBe("Camaleonic Survey Encuestas con IA para escuchar a tus clientes, empleados y proveedores.");
  });

  it("returns null for pages with too little extracted text", async () => {
    mockFetchOnce({ text: async () => "<html><body><p>Hi</p></body></html>" });
    expect(await fetchWebsiteText("https://example.com")).toBeNull();
  });

  it("returns null instead of throwing when fetch rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    expect(await fetchWebsiteText("https://example.com")).toBeNull();
  });

  it("retries without 'www.' when the www subdomain fails to resolve (real-world DNS mismatch)", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === "https://www.camaleonicsurvey.com/") return Promise.reject(new Error("getaddrinfo ENOTFOUND"));
      if (url === "https://camaleonicsurvey.com/") {
        return Promise.resolve({
          ok: true,
          headers: new Headers({ "content-type": "text/html" }),
          text: async () => "<html><body><p>Encuestas con IA para escuchar a tus clientes, empleados y proveedores de verdad.</p></body></html>",
        } as Response);
      }
      throw new Error(`unexpected URL in test: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const text = await fetchWebsiteText("https://www.camaleonicsurvey.com");
    expect(text).toContain("Encuestas con IA");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("normalizes a scheme-less input (e.g. 'www.tuweb.com' typed without https://) before fetching", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "text/html" }),
      text: async () => "<html><body><p>Contenido de sobra para superar el mínimo de caracteres exigido.</p></body></html>",
    } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const text = await fetchWebsiteText("www.example.com");
    expect(text).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledWith("https://www.example.com/", expect.anything());
  });
});

describe("normalizeUrl", () => {
  it("adds https:// when the input has no scheme", () => {
    expect(normalizeUrl("www.tuweb.com")).toBe("https://www.tuweb.com/");
    expect(normalizeUrl("tuweb.com")).toBe("https://tuweb.com/");
  });

  it("leaves an existing http(s) scheme untouched", () => {
    expect(normalizeUrl("http://tuweb.com")).toBe("http://tuweb.com/");
    expect(normalizeUrl("https://tuweb.com/pagina")).toBe("https://tuweb.com/pagina");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeUrl("  tuweb.com  ")).toBe("https://tuweb.com/");
  });

  it("returns null for empty input or input that still isn't a valid URL", () => {
    expect(normalizeUrl("")).toBeNull();
    expect(normalizeUrl("   ")).toBeNull();
    expect(normalizeUrl("not a url at all")).toBeNull();
  });
});

describe("toggleWwwPrefix", () => {
  it("removes 'www.' when present", () => {
    expect(toggleWwwPrefix("https://www.camaleonicsurvey.com/")).toBe("https://camaleonicsurvey.com/");
  });

  it("adds 'www.' when absent", () => {
    expect(toggleWwwPrefix("https://camaleonicsurvey.com/")).toBe("https://www.camaleonicsurvey.com/");
  });

  it("returns null for an invalid URL", () => {
    expect(toggleWwwPrefix("not-a-url")).toBeNull();
  });
});
