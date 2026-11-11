import { describe, expect, it } from "vitest";
import { keyRowsPayload, rowsFromValue, validateKeyRows } from "./ApiKeyListEditor";

describe("api key rows", () => {
  it("retains saved keys by reference and sends new values", () => {
    const rows = rowsFromValue({ revision: "r1", entries: [{ reference: 0 }, { reference: 1 }] });
    rows.reverse();
    rows.push({ uid: 99, value: " sk-new " });
    expect(keyRowsPayload("r1", rows)).toEqual({
      revision: "r1",
      entries: [{ retain: 1 }, { retain: 0 }, { value: "sk-new" }],
    });
  });

  it("replaces a saved key when a new value is typed", () => {
    const rows = rowsFromValue({ revision: "r", entries: [{ reference: 0 }] });
    rows[0].value = "sk-replacement";
    expect(keyRowsPayload("r", rows).entries).toEqual([{ value: "sk-replacement" }]);
  });

  it("flags empty new rows and duplicates", () => {
    const errors = validateKeyRows([
      { uid: 1, value: "a" },
      { uid: 2, value: "" },
      { uid: 3, value: "a" },
    ]);
    expect(errors).toEqual({ 1: "Enter a key or remove this row.", 2: "Duplicates key 1." });
    expect(validateKeyRows([{ uid: 1, value: "", reference: 0 }])).toBeNull();
  });
});
