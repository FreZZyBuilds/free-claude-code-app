import { describe, expect, it } from "vitest";
import { parseSseFrames } from "./stream";

function collect(buffer: string) {
  const frames: { event: string; data: string }[] = [];
  const it = parseSseFrames(buffer);
  let n = it.next();
  while (!n.done) {
    frames.push(n.value);
    n = it.next();
  }
  return { frames, rest: n.value };
}

describe("parseSseFrames", () => {
  it("splits complete frames and keeps the partial tail", () => {
    const { frames, rest } = collect('event: a\ndata: {"x":1}\n\nevent: b\ndata: {"y"');
    expect(frames).toEqual([{ event: "a", data: '{"x":1}' }]);
    expect(rest).toBe('event: b\ndata: {"y"');
  });

  it("handles CRLF and multi-line data", () => {
    const { frames } = collect("data: one\r\ndata: two\r\n\r\n");
    expect(frames).toEqual([{ event: "message", data: "one\ntwo" }]);
  });

  it("ignores comment-only frames", () => {
    const { frames } = collect(": ping\n\n");
    expect(frames).toEqual([]);
  });
});
