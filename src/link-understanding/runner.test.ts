import { describe, expect, it, vi } from "vitest";
import type { MsgContext } from "../auto-reply/templating.js";
import type { OpenClawConfig } from "../config/config.js";
import { runLinkUnderstanding } from "./runner.js";

const runExecMock = vi.fn();

vi.mock("../process/exec.js", () => ({
  runExec: (...args: unknown[]) => runExecMock(...args),
}));

function createConfig(concurrency?: number, maxConcurrent?: number): OpenClawConfig {
  return {
    agents: { defaults: { maxConcurrent } },
    tools: {
      links: {
        enabled: true,
        concurrency,
        models: [
          {
            type: "cli",
            command: "mock-cli",
            args: ["--url", "{{LinkUrl}}"],
          },
        ],
      },
    },
  } as OpenClawConfig;
}

function createCtx(body: string): MsgContext {
  return {
    Body: body,
    Provider: "test",
  };
}

describe("runLinkUnderstanding", () => {
  it("runs links concurrently when configured", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    runExecMock.mockImplementation(async (_cmd: string, args: string[]) => {
      const url = args.at(-1) ?? "";
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 20));
      inFlight -= 1;
      return { stdout: `summary:${url}` };
    });

    const result = await runLinkUnderstanding({
      cfg: createConfig(3),
      ctx: createCtx("https://a.test https://b.test https://c.test"),
    });

    expect(result.urls).toEqual(["https://a.test", "https://b.test", "https://c.test"]);
    expect(result.outputs).toEqual([
      "summary:https://a.test",
      "summary:https://b.test",
      "summary:https://c.test",
    ]);
    expect(maxInFlight).toBe(3);
  });

  it("caps explicit concurrency to agent maxConcurrent", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    runExecMock.mockImplementation(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 20));
      inFlight -= 1;
      return { stdout: "ok" };
    });

    await runLinkUnderstanding({
      cfg: createConfig(10, 2),
      ctx: createCtx("https://a.test https://b.test https://c.test"),
    });

    expect(maxInFlight).toBe(2);
  });

  it("uses adaptive default parallelism from agent concurrency", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    runExecMock.mockImplementation(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 20));
      inFlight -= 1;
      return { stdout: "ok" };
    });

    await runLinkUnderstanding({
      cfg: createConfig(undefined, 2),
      ctx: createCtx("https://a.test https://b.test https://c.test"),
    });

    expect(maxInFlight).toBe(2);
  });

  it("falls back to default link concurrency when agent limit is unset", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    runExecMock.mockImplementation(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 20));
      inFlight -= 1;
      return { stdout: "ok" };
    });

    await runLinkUnderstanding({
      cfg: createConfig(),
      ctx: createCtx("https://a.test https://b.test https://c.test"),
    });

    expect(maxInFlight).toBe(3);
  });
});
