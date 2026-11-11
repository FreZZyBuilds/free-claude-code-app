import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Markdown } from "./markdown";

describe("Markdown", () => {
  it("renders code, lists and emphasis", () => {
    const { container } = render(<Markdown text={"Hi **there**\n\n```js\nx()\n```\n- a\n- b"} />);
    expect(container.querySelector("strong")?.textContent).toBe("there");
    expect(container.querySelector("pre code")?.textContent).toBe("x()");
    expect(container.querySelectorAll("li")).toHaveLength(2);
  });

  it("never turns model output into markup", () => {
    const { container } = render(<Markdown text={'<img src=x onerror="alert(1)"> [x](javascript:alert(1))'} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toContain("<img");
  });
});
