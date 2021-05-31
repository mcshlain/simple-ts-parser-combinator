import {Parser as P} from "./parserCombinator";

describe("simpleParser", () => {


  test("basic parser - str", () => {

    const abaParser = P.str("aba")

    expect(abaParser.parse("aba")).toEqual(
      { 
        type: "success",
        result: "aba"
      }
    );

    // doesn't match at all
    expect(abaParser.parse("123")).toMatchObject(
      { 
        type: "failure",
      }
    );

    // has additional character b
    expect(abaParser.parse("abab")).toMatchObject(
      { 
        type: "failure",
      }
    );

  });

  test("basic parser - regex", () => {

    const digitsParser = P.regex(/\d+/)

    expect(digitsParser.parse("aba")).toMatchObject(
      { 
        type: "failure",
      }
    );

    expect(digitsParser.parse("123")).toEqual(
      { 
        type: "success",
        result: "123"
      }
    );

    expect(digitsParser.parse("9999")).toEqual(
      { 
        type: "success",
        result: "9999"
      }
    );

  });

  test("changing parser sucess output - mapping", () => {

    const integerParser = P.regex(/\d+/).map((r) => parseInt(r))
    // or even shorter: const numberParser = P.regex(/\d+/).map(parseInt)

   expect(integerParser.parse("aba")).toMatchObject(
      { 
        type: "failure",
      }
    );

    expect(integerParser.parse("123")).toEqual(
      { 
        type: "success",
        result: 123
      }
    );

    expect(integerParser.parse("9999")).toEqual(
      { 
        type: "success",
        result: 9999
      }
    );

    const floatParser = P.regex(/-?\d+(\.\d+)?/).map(parseFloat)

   expect(floatParser.parse("aba")).toMatchObject(
      { 
        type: "failure",
      }
    );

    expect(floatParser.parse("-123.2")).toEqual(
      { 
        type: "success",
        result: -123.2
      }
    );

    expect(floatParser.parse("99.12")).toEqual(
      { 
        type: "success",
        result: 99.12
      }
    );

  });

  test("alternatives", () => {

    const fuzzyIntParaser = P.alternatives(
      P.regex(/\d+/).map((r) => parseInt(r)),
      P.str("one").map(() => 1),
      P.str("two").map(() => 2),
      P.str("three").map(() => 3),
      P.str("four").map(() => 4),
      P.str("five").map(() => 5),
      P.str("six").map(() => 6),
      P.str("seven").map(() => 7),
      P.str("eight").map(() => 8),
      P.str("nine").map(() => 9),
    );

   expect(fuzzyIntParaser.parse("99")).toEqual(
      { 
        type: "success",
        result: 99
      }
    );

   expect(fuzzyIntParaser.parse("5")).toEqual(
      { 
        type: "success",
        result: 5
      }
    );

   expect(fuzzyIntParaser.parse("three")).toEqual(
      { 
        type: "success",
        result: 3
      }
    );

  })

  test("parse email - use of sequence", () => {
    const emailParser = P.sequence(
      P.regex(/\w+/), 
      P.str("@"), 
      P.regex(/\w+/), 
      P.str("."), 
      P.alternatives(P.str("com"), 
      P.str("net"))
    ).map((parts) => ({name: parts[0], domain: parts[2]}));

    expect(emailParser.parse("jimmy@gmail.com")).toEqual(
      { 
        type: "success",
        result: {
          name: "jimmy",
          domain: "gmail"
        }
      }
    );

    expect(emailParser.parse("jimmy@gmail")).toMatchObject(
      { 
        type: "failure",
      }
    );

  });

  test("quantifiers", () => {
    
    const whitespace = P.regex(/\s+/);
    const word = P.regex(/\w+/).map((value) => ({type: "word", value}));
    const integer = P.regex(/\d+/).map((value) => ({type: "integer", value: parseInt(value)}));

    // X.or(Y) is the same as P.alternative(X, Y)    
    // The alternatives are considered in order so integer will be tried before word
    const sentenceParser = integer.or(word).oneOrMoreTimes({delimiterParser: whitespace});

    expect(sentenceParser.parse("marry jumped    12 times")).toEqual({
      type: "success",
      result: [
        {
          type: "word",
          value: "marry"
        }, {
          type: "word",
          value: "jumped"
        }, {
          type: "integer",
          value: 12
        }, {
          type: "word",
          value: "times"
        }
      ]
    });

  });

});
