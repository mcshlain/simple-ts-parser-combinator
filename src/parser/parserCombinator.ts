/* eslint-disable @typescript-eslint/no-this-alias */

import {
  curried2, flipped2, reduce,
} from "./utils";

interface ParsingState {
  input: string;
  offset: number;
}

export interface Success<A> {
  type: "success";
  result: A;
}

export interface Failure {
  type: "failure";
  expected: string;
  got: string;
  offset: number;
}

export type ParsingResult<A> = Success<A> | Failure;

// result type used by tailRecM since we don't have a generic Either
type RecResult<A, B> = {type: "continue"; nextState: A} | {type: "stop"; result: B};

export abstract class Parser<A> {
  // -------------- //
  // Base signature //
  // -------------- //

  abstract parsePartial(state: ParsingState): [ParsingState, ParsingResult<A>];

  // for parse to be considered successful it should consume the entire input
  // so in terms of partialParse we enfore that by making sure EOF is following the parser
  parse = (input: string): ParsingResult<A> => this.skip(Parser.EOF).parsePartial({ input, offset: 0 })[1];

  // ---------------- //
  // Concrete Parsers //
  // ---------------- //
  public static EOF: Parser<string> = new class extends Parser<string> {
      parsePartial = (state: ParsingState): [ParsingState, ParsingResult<string>] => {
        if (state.input === "") {
          return [state, { type: "success", result: "" }];
        }

        return [state, {
          type: "failure",
          expected: "EOF",
          got: `${state.input.substring(0, 20)}...`,
          offset: state.offset,
        }];
      }
  }();

  // We use generics here to allow typescript correct inference with literals
  // So that str("abc") will produce a Parser<"abc"> and not the general Parser<string>
  public static str<A extends string>(prefix: A): Parser<A> {
    return new class extends Parser<A> {
      parsePartial = (state: ParsingState): [ParsingState, ParsingResult<A>] => {
        if (state.input.startsWith(prefix)) {
          return [
            {
              input: state.input.substring(prefix.length, state.input.length),
              offset: state.offset + prefix.length,
            },
            { type: "success", result: prefix },
          ];
        }

        return [state, {
          type: "failure",
          expected: prefix,
          got: `${state.input.substring(0, 20)}...`,
          offset: state.offset,
        }];
      }
    }();
  }

  public static regex(r: RegExp): Parser<string> {
    return new class extends Parser<string> {
      parsePartial = (state: ParsingState): [ParsingState, ParsingResult<string>] => {
        const match = r.exec(state.input);
        if (match != null && match.index === 0) {
          const found = match[0];
          return [
            {
              input: state.input.substring(found.length, state.input.length),
              offset: state.offset + found.length,
            },
            { type: "success", result: found },
          ];
        }

        return [state, {
          type: "failure",
          expected: `${r}`,
          got: `${state.input.substring(0, 20)}...`,
          offset: state.offset,
        }];
      }
    }();
  }

  // ------------------ //
  // Combinator Methods //
  // ------------------ //

  // monadic bind
  public bind<B>(f: (a: A) => Parser<B>): Parser<B> {
    // a reference for internal classes to refer to without ambiguity with this
    const self = this;
    return new class extends Parser<B> {
      parsePartial = (s0: ParsingState): [ParsingState, ParsingResult<B>] => {
        const [s1, r] = self.parsePartial(s0);
        if (r.type === "failure") {
          return [s1, r];
        }
        return f(r.result).parsePartial(s1);
      }
    }();
  }

  public or<B>(pb: Parser<B>): Parser<A | B> {
    const self = this;
    return new class extends Parser<A | B> {
      parsePartial = (s0: ParsingState): [ParsingState, ParsingResult<A | B>] => {
        const [s1, r] = self.parsePartial(s0);
        if (r.type === "failure") {
          return pb.parsePartial(s0);
        }
        return [s1, r];
      }
    }();
  }

  public desc(name: string): Parser<A> {
    const self = this;
    return new class extends Parser<A> {
      parsePartial = (state: ParsingState): [ParsingState, ParsingResult<A>] => {
        const [s1, r] = self.parsePartial(state);
        if (r.type === "failure") {
          return [s1, { ...r, expected: name }];
        }
        return [s1, r];
      }
    }();
  }

  // -------------------------- //
  // Derived combinator methods //
  // -------------------------- //

  // functor map
  public map<B>(f: (a: A) => B): Parser<B> {
    return this.bind((a) => Parser.success(f(a)));
  }

  // applicative functor apply
  public apply<B>(ff: Parser<(a: A) => B>): Parser<B> {
    return this.bind((a) => ff.map((f) => f(a)));
  }

  public skip<B>(pb: Parser<B>): Parser<A> {
    return this.bind((a) => pb.map((_) => a));
  }

  public then<B>(pb: Parser<B>): Parser<B> {
    return this.bind((_) => pb);
  }

  public surroundedBy(s: string, e?: string): Parser<A> {
    return Parser.str(s).then(this).skip(Parser.str(e ?? s));
  }

  // the additional (and first) variant with extends string, help the typescript
  // typechecked to keep literal sting values instead of upcasting them into the
  // general string
  public result<B extends string>(b: B): Parser<B>
  public result<B>(b: B): Parser<B> {
    return this.map((_) => b);
  }

  public recoverWith<B>(b: B): Parser<A | B> {
    return this.or(Parser.success(b));
  }

  public times(min: number, max?: number): Parser<Array<A>> {
    const minParser = this.repeat(min);
    if (max === undefined || max <= min) {
      return minParser;
    }
    return Parser.map2(minParser, this.atMost(max - min), (a, b) => [...a, ...b]);
  }

  public repeat(n: number): Parser<Array<A>> {
    const self = this;
    return Parser.tailRecM<[number, Array<A>], Array<A>>([n, []], ([i, collectedValues]) => {
      if (i <= 0) {
        return Parser.success({ type: "stop", result: collectedValues });
      }
      return self.map(
        (v) => ({ type: "continue", nextState: [i - 1, [...collectedValues, v]] }),
      );
    });
  }

  public atMost(n: number): Parser<Array<A>> {
    const self = this;
    return Parser.tailRecM<[number, Array<A>], Array<A>>([n, []], ([i, collectedValues]) => {
      if (i <= 0) {
        return Parser.success({ type: "stop", result: collectedValues });
      }
      return self.map(
        (v) => ({ type: "continue", nextState: [i - 1, [...collectedValues, v]] }),
      ).recoverWith({
        type: "stop",
        result: collectedValues,
      }) as Parser<RecResult<[number, Array<A>], Array<A>>>;
    });
  }

  public oneOrMoreTimes(opts?: {delimiter?: string; delimiterParser?: Parser<unknown>}): Parser<Array<A>> {
    if (opts !== undefined && (opts.delimiter !== undefined || opts.delimiterParser !== undefined)) {
      let preceededByDelim: Parser<A>;
      if (opts.delimiter !== undefined) {
        preceededByDelim = Parser.str(opts.delimiter).then(this);
      } else if (opts.delimiterParser !== undefined) {
        preceededByDelim = opts.delimiterParser.then(this);
      } else {
        throw new Error("Should never reach here");
      }

      // a prefix of zero or more items with a delim and an additional end item
      return this.bind((h) => preceededByDelim.times(0, Number.MAX_SAFE_INTEGER).map((t) => [h, ...t]));
    }

    return this.times(1, Number.MAX_SAFE_INTEGER);
  }

  public zeroOrMoreTimes(opts?: {delimiter?: string; delimiterParser?: Parser<unknown>}): Parser<Array<A>> {
    return this.oneOrMoreTimes(opts).recoverWith([]);
  }

  public optional(): Parser<A | undefined> {
    return this.recoverWith(undefined);
  }

  // -------------------- //
  // Combinator Functions //
  // -------------------- //

  public static success<A>(a: A): Parser<A> {
    return new class extends Parser<A> {
      parsePartial = (s0: ParsingState): [ParsingState, ParsingResult<A>] => {
        return [s0, { type: "success", result: a }];
      }
    }();
  }

  public static fail(expected: string): Parser<never> {
    return new class extends Parser<never> {
      parsePartial = (state: ParsingState): [ParsingState, ParsingResult<never>] => {
        return [state, {
          type: "failure",
          expected,
          got: `${state.input.substring(20)}...`,
          offset: state.offset,
        }];
      }
    }();
  }

  public static tailRecM<A, B>(init: A, fn: (a: A) => Parser<RecResult<A, B>>): Parser<B> {
    return new class extends Parser<B> {
      parsePartial = (state: ParsingState): [ParsingState, ParsingResult<B>] => {
        let current: A = init;
        let currentState = state;

        // implement in terms of a loop, since we don't have tail recursion optimization in JS
        while (true) {
          const [newState, parseResult] = fn(current).parsePartial(currentState);
          currentState = newState;

          // if parsing failed we're done, just return the failure
          if (parseResult.type === "failure") {
            return [currentState, parseResult as ParsingResult<B>];
          }

          // if recursive function indicated we should stop we stop with success
          if (parseResult.result.type === "stop") {
            return [currentState, { type: "success", result: parseResult.result.result }];
          }

          // the recursive function indicated we should continue, so we just update the new state
          current = parseResult.result.nextState;
        }
      }
    }();
  }

  public static map2<A, B, C>(pa: Parser<A>, pb: Parser<B>, f: (a: A, b: B) => C): Parser<C> {
    return pa.apply(pb.map((b) => curried2(flipped2(f))(b)));
  }

  public static product<A, B>(pa: Parser<A>, pb: Parser<B>): Parser<[A, B]> {
    return Parser.map2(pa, pb, (a, b) => [a, b]);
  }

  // overloaded definition to get more precise types in cases when sequencing parsers of different types
  public static sequence<A>(a: Parser<A>): Parser<Array<A>>;
  public static sequence<A, B>(a: Parser<A>, b: Parser<B>): Parser<[A, B]>;
  public static sequence<A, B, C>(a: Parser<A>, b: Parser<B>, c: Parser<C>): Parser<[A, B, C]>;
  public static sequence<A, B, C, D>(a: Parser<A>, b: Parser<B>, c: Parser<C>, d: Parser<D>): Parser<[A, B, C, D]>;
  public static sequence<A, B, C, D, E>(
    a: Parser<A>, b: Parser<B>, c: Parser<C>, d: Parser<D>, e: Parser<E>): Parser<[A, B, C, D, E]>;
  public static sequence<A>(...rest: Array<Parser<A>>): Parser<Array<A>> {
    return Parser.tailRecM<[number, Array<A>], Array<A>>([0, []], ([i, collectedValues]) => {
      if (i === rest.length) {
        return Parser.success({ type: "stop", result: collectedValues });
      }
      return rest[i].map(
        (v) => ({ type: "continue", nextState: [i + 1, [...collectedValues, v]] }),
      );
    });
  }

  public static alternatives<A>(h: Parser<A>, ...t: Array<Parser<A>>): Parser<A> {
    return reduce((a, b) => a.or(b), [h, ...t]);
  }

  public static concat(p: Parser<Array<string>>): Parser<string> {
    return p.map((rs) => rs.join(""));
  }
}
