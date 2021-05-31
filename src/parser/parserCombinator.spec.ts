import { Parser as P } from "./parserCombinator";

describe("parserCombinator", () => {
  test("basic EOF parser", () => {
    const parser = P.EOF;

    expect(parser.parse("")).toEqual({ type: "success", result: "" });
    expect(parser.parse("123")).toMatchObject({ type: "failure" });
    expect(parser.parse("45")).toMatchObject({ type: "failure" });
  });

  test("basic str parser", () => {
    const parser = P.str("12");

    expect(parser.parse("12")).toEqual({ type: "success", result: "12" });
    expect(parser.parse("123")).toMatchObject({ type: "failure" });
    expect(parser.parse("45")).toMatchObject({ type: "failure" });
  });

  test("basic regex parser", () => {
    const parser = P.regex(/\d{1,3}/);

    expect(parser.parse("12")).toEqual({ type: "success", result: "12" });
    expect(parser.parse("123")).toEqual({ type: "success", result: "123" });
    expect(parser.parse("45a")).toMatchObject({ type: "failure" });
    expect(parser.parse("a45")).toMatchObject({ type: "failure" });
  });

  test("map", () => {
    const parser = P.regex(/\d{1,3}/).map((d) => +d);

    expect(parser.parse("12")).toEqual({ type: "success", result: 12 });
    expect(parser.parse("123")).toEqual({ type: "success", result: 123 });
    expect(parser.parse("1234")).toMatchObject({ type: "failure" });
    expect(parser.parse("45a")).toMatchObject({ type: "failure" });
    expect(parser.parse("a45")).toMatchObject({ type: "failure" });
  });

  test("bind", () => {
    const parser = P.regex(/\d{1,3}/)
      .map((d) => +d)
      .bind((a) => {
        if (a > 10) {
          return P.str("a");
        }

        return P.str("b");
      });

    expect(parser.parse("12")).toMatchObject({ type: "failure" });
    expect(parser.parse("123")).toMatchObject({ type: "failure" });
    expect(parser.parse("45a")).toEqual({ type: "success", result: "a" });
    expect(parser.parse("a45")).toMatchObject({ type: "failure" });
    expect(parser.parse("2b")).toEqual({ type: "success", result: "b" });
    expect(parser.parse("b2")).toMatchObject({ type: "failure" });
  });

  test("product", () => {
    const parser = P.product(P.regex(/\d{1,3}/), P.str("a"));

    expect(parser.parse("12")).toMatchObject({ type: "failure" });
    expect(parser.parse("123")).toMatchObject({ type: "failure" });
    expect(parser.parse("45a")).toEqual({
      type: "success",
      result: ["45", "a"],
    });
    expect(parser.parse("a45")).toMatchObject({ type: "failure" });
  });

  test("sequence", () => {
    const parser = P.sequence(
      P.regex(/\d{1,3}/),
      P.str(","),
      P.regex(/\d{1,3}/),
    );

    expect(parser.parse("12")).toMatchObject({ type: "failure" });
    expect(parser.parse("123")).toMatchObject({ type: "failure" });
    expect(parser.parse("45,12")).toEqual({
      type: "success",
      result: ["45", ",", "12"],
    });
    expect(parser.parse("a45")).toMatchObject({ type: "failure" });
  });

  test("alternatives", () => {
    const parser = P.alternatives(P.str("a"), P.str("b"), P.str("c"));

    expect(parser.parse("a")).toEqual({ type: "success", result: "a" });
    expect(parser.parse("b")).toEqual({ type: "success", result: "b" });
    expect(parser.parse("c")).toEqual({ type: "success", result: "c" });
    expect(parser.parse("d")).toMatchObject({ type: "failure" });
    expect(parser.parse("a45")).toMatchObject({ type: "failure" });
  });

  test("surroundedBy and describe", () => {
    const parser = P.regex(/\w+/).surroundedBy("{", "}").desc("list_var");

    expect(parser.parse("12")).toMatchObject({
      type: "failure",
      expected: "list_var",
    });

    expect(parser.parse("{my_list}")).toEqual({
      type: "success",
      result: "my_list",
    });
  });

  test("repeat", () => {
    const parser = P.str("a").repeat(4);
    expect(parser.parse("")).toMatchObject({ type: "failure" });
    expect(parser.parse("a")).toMatchObject({ type: "failure" });
    expect(parser.parse("aa")).toMatchObject({ type: "failure" });
    expect(parser.parse("aaa")).toMatchObject({ type: "failure" });
    expect(parser.parse("aaaa")).toEqual({
      type: "success",
      result: ["a", "a", "a", "a"],
    });
    expect(parser.parse("aaaaa")).toMatchObject({ type: "failure" });
  });

  test("atMost", () => {
    const parser = P.str("a").atMost(4);

    expect(parser.parse("")).toEqual({ type: "success", result: [] });
    expect(parser.parse("a")).toEqual({ type: "success", result: ["a"] });
    expect(parser.parse("aa")).toEqual({ type: "success", result: ["a", "a"] });
    expect(parser.parse("aaa")).toEqual({
      type: "success",
      result: ["a", "a", "a"],
    });
    expect(parser.parse("aaaa")).toEqual({
      type: "success",
      result: ["a", "a", "a", "a"],
    });
    expect(parser.parse("aaaaa")).toMatchObject({ type: "failure" });
  });

  test("repeat zero", () => {
    let parser = P.str("a").repeat(0);

    expect(parser.parse("")).toEqual({ type: "success", result: [] });
    expect(parser.parse("b")).toMatchObject({ type: "failure" });
    expect(parser.parse("a")).toMatchObject({ type: "failure" });
    expect(parser.parse("aa")).toMatchObject({ type: "failure" });
    expect(parser.parse("a,a")).toMatchObject({ type: "failure" });
    expect(parser.parse("aaaaa")).toMatchObject({ type: "failure" });
    expect(parser.parse("a,a,a,a,a")).toMatchObject({ type: "failure" });

    parser = P.str("a").repeat(1);

    expect(parser.parse("")).toMatchObject({ type: "failure" });
    expect(parser.parse("b")).toMatchObject({ type: "failure" });
    expect(parser.parse("a")).toEqual({ type: "success", result: ["a"] });
    expect(parser.parse("aa")).toMatchObject({ type: "failure" });
    expect(parser.parse("a,a")).toMatchObject({ type: "failure" });
    expect(parser.parse("aaaaa")).toMatchObject({ type: "failure" });
    expect(parser.parse("a,a,a,a,a")).toMatchObject({ type: "failure" });

    parser = P.str("a").repeat(5);

    expect(parser.parse("")).toMatchObject({ type: "failure" });
    expect(parser.parse("b")).toMatchObject({ type: "failure" });
    expect(parser.parse("a")).toMatchObject({ type: "failure" });
    expect(parser.parse("aa")).toMatchObject({ type: "failure" });
    expect(parser.parse("a,a")).toMatchObject({ type: "failure" });
    expect(parser.parse("aaaaa")).toEqual({
      type: "success",
      result: ["a", "a", "a", "a", "a"],
    });
    expect(parser.parse("a,a,a,a,a")).toMatchObject({ type: "failure" });
  });

  test("times", () => {
    const parser = P.str("a").times(2, 4);

    expect(parser.parse("a")).toMatchObject({ type: "failure" });
    expect(parser.parse("aa")).toEqual({ type: "success", result: ["a", "a"] });
    expect(parser.parse("aaa")).toEqual({
      type: "success",
      result: ["a", "a", "a"],
    });
    expect(parser.parse("aaaa")).toEqual({
      type: "success",
      result: ["a", "a", "a", "a"],
    });
    expect(parser.parse("aaaaa")).toMatchObject({ type: "failure" });
  });

  test("oneOrMoreTimes", () => {
    const parser = P.str("a").oneOrMoreTimes();

    expect(parser.parse("")).toMatchObject({ type: "failure" });
    expect(parser.parse("b")).toMatchObject({ type: "failure" });
    expect(parser.parse("a")).toEqual({ type: "success", result: ["a"] });
    expect(parser.parse("aa")).toEqual({ type: "success", result: ["a", "a"] });
    expect(parser.parse("aaa")).toEqual({
      type: "success",
      result: ["a", "a", "a"],
    });
    expect(parser.parse("aaaa")).toEqual({
      type: "success",
      result: ["a", "a", "a", "a"],
    });
    expect(parser.parse("aaaaa")).toEqual({
      type: "success",
      result: ["a", "a", "a", "a", "a"],
    });
  });

  test("oneOrMoreTimes with delimiter", () => {
    const parser = P.str("a").oneOrMoreTimes({ delimiter: "," });

    expect(parser.parse("")).toMatchObject({ type: "failure" });
    expect(parser.parse("b")).toMatchObject({ type: "failure" });
    expect(parser.parse("a")).toEqual({ type: "success", result: ["a"] });
    expect(parser.parse("aa")).toMatchObject({ type: "failure" });
    expect(parser.parse("a,a")).toEqual({
      type: "success",
      result: ["a", "a"],
    });
    expect(parser.parse("aaaaa")).toMatchObject({ type: "failure" });
    expect(parser.parse("a,a,a,a,a")).toEqual({
      type: "success",
      result: ["a", "a", "a", "a", "a"],
    });
  });

  test("optional", () => {
    const parser = P.str("a").optional();

    expect(parser.parse("")).toEqual({ type: "success", result: undefined });
    expect(parser.parse("b")).toMatchObject({ type: "failure" });
    expect(parser.parse("a")).toEqual({ type: "success", result: "a" });
    expect(parser.parse("aa")).toMatchObject({ type: "failure" });
    expect(parser.parse("a,a")).toMatchObject({ type: "failure" });
    expect(parser.parse("aaaaa")).toMatchObject({ type: "failure" });
    expect(parser.parse("a,a,a,a,a")).toMatchObject({ type: "failure" });
  });

  test("times with zero", () => {
    const parser = P.str("a").times(0, 2);

    expect(parser.parse("")).toEqual({ type: "success", result: [] });
    expect(parser.parse("b")).toMatchObject({ type: "failure" });
    expect(parser.parse("a")).toEqual({ type: "success", result: ["a"] });
    expect(parser.parse("aa")).toEqual({ type: "success", result: ["a", "a"] });
    expect(parser.parse("aaa")).toMatchObject({ type: "failure" });

    // make sure times doesn't fail if it passes max and that it correctly stops
    // successfully after the max values are parsed
    expect(parser.parsePartial({ offset: 0, input: "aaa" })).toEqual([
      { offset: 2, input: "a" },
      { type: "success", result: ["a", "a"] },
    ]);
  });

  test("skip with times", () => {
    const parser = P.regex(/a+/).skip(P.regex(/\s+/).optional()).times(0, 2);

    expect(parser.parse("")).toEqual({ type: "success", result: [] });
    expect(parser.parse("b")).toMatchObject({ type: "failure" });
    expect(parser.parse("a")).toEqual({ type: "success", result: ["a"] });
    expect(parser.parse("aa")).toEqual({ type: "success", result: ["aa"] });
    expect(parser.parse("a a")).toEqual({
      type: "success",
      result: ["a", "a"],
    });
    expect(parser.parse("a  a")).toEqual({
      type: "success",
      result: ["a", "a"],
    });
    expect(parser.parse("a,a")).toMatchObject({ type: "failure" });
    expect(parser.parse("aaaaa")).toMatchObject({
      type: "success",
      result: ["aaaaa"],
    });
    expect(parser.parse("a,a,a,a,a")).toMatchObject({ type: "failure" });
  });

  test("oneOrMoreTimes with delimiterParser", () => {
    const parser = P.str("a").oneOrMoreTimes({
      delimiterParser: P.regex(/\s+/).optional(),
    });

    expect(parser.parse("")).toMatchObject({ type: "failure" });
    expect(parser.parse("b")).toMatchObject({ type: "failure" });
    expect(parser.parse("a")).toEqual({ type: "success", result: ["a"] });
    expect(parser.parse("aa")).toEqual({ type: "success", result: ["a", "a"] });
    expect(parser.parse("a a")).toEqual({
      type: "success",
      result: ["a", "a"],
    });
    expect(parser.parse("aaaaa")).toEqual({
      type: "success",
      result: ["a", "a", "a", "a", "a"],
    });
  });

  test("zeroOrMoreTimes with delimiterParser", () => {
    const parser = P.str("a").zeroOrMoreTimes({
      delimiterParser: P.regex(/\s+/).optional(),
    });

    expect(parser.parse("")).toEqual({ type: "success", result: [] });
    expect(parser.parse("b")).toMatchObject({ type: "failure" });
    expect(parser.parse("a")).toEqual({ type: "success", result: ["a"] });
    expect(parser.parse("aa")).toEqual({ type: "success", result: ["a", "a"] });
    expect(parser.parse("a a")).toEqual({
      type: "success",
      result: ["a", "a"],
    });
    expect(parser.parse("aaaaa")).toEqual({
      type: "success",
      result: ["a", "a", "a", "a", "a"],
    });
  });
});