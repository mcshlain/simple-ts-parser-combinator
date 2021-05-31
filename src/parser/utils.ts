
export function curried2<A, B, C>(f: (a: A, b: B) => C): (a: A) => ((b: B) => C) {
  return (a: A) => (b: B) => f(a, b);
}

export function flipped2<A, B, C>(f: (a: A, b: B) => C): (b: B, a: A) => C {
  return (b: B, a: A) => f(a, b);
}

export function reduce<A>(f: (a: A, b: A) => A, lst: Array<A>): A {
  if (lst.length === 0) {
    throw new Error("reduce is undefined for empty lists");
  }
  const [first, ...rest] = lst;
  let result = first;
  rest.forEach((b) => {
    result = f(result, b);
  });
  return result;
}
