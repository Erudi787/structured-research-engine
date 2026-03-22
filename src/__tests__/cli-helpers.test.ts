import { describe, it, expect } from "vitest";

// Inline the helpers here to test them without running the CLI entrypoint
function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        args[key] = next;
        i++;
      } else {
        args[key] = "true";
      }
    }
  }
  return args;
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

describe("parseArgs", () => {
  it("parses key-value pairs", () => {
    const result = parseArgs(["--title", "My Research", "--depth", "deep"]);
    expect(result.title).toBe("My Research");
    expect(result.depth).toBe("deep");
  });

  it("parses flag without value as 'true'", () => {
    const result = parseArgs(["--help"]);
    expect(result.help).toBe("true");
  });

  it("handles consecutive flags", () => {
    const result = parseArgs(["--help", "--output", "json"]);
    expect(result.help).toBe("true");
    expect(result.output).toBe("json");
  });

  it("returns empty object for empty argv", () => {
    expect(parseArgs([])).toEqual({});
  });

  it("ignores non-flag tokens", () => {
    const result = parseArgs(["notaflag", "--title", "Research"]);
    expect(result.title).toBe("Research");
    expect(result.notaflag).toBeUndefined();
  });

  it("parses all expected CLI flags", () => {
    const result = parseArgs([
      "--title", "Test",
      "--query", "What is AI?",
      "--depth", "brief",
      "--format", "MLA",
      "--lang", "es",
      "--output", "pretty",
    ]);
    expect(result.title).toBe("Test");
    expect(result.query).toBe("What is AI?");
    expect(result.depth).toBe("brief");
    expect(result.format).toBe("MLA");
    expect(result.lang).toBe("es");
    expect(result.output).toBe("pretty");
  });
});

describe("slugify", () => {
  it("lowercases the title", () => {
    expect(slugify("QUANTUM COMPUTING")).toBe("quantum-computing");
  });

  it("replaces spaces with hyphens", () => {
    expect(slugify("hello world")).toBe("hello-world");
  });

  it("collapses multiple special characters into one hyphen", () => {
    expect(slugify("hello  world!?")).toBe("hello-world");
  });

  it("strips leading and trailing hyphens", () => {
    expect(slugify("  hello  ")).toBe("hello");
  });

  it("truncates to 80 characters", () => {
    const long = "a".repeat(100);
    expect(slugify(long).length).toBeLessThanOrEqual(80);
  });

  it("handles special characters", () => {
    expect(slugify("C++ & Rust: A Comparison")).toBe("c-rust-a-comparison");
  });

  it("handles empty string", () => {
    expect(slugify("")).toBe("");
  });
});
