contract math {
  function max(uint64 a, uint64 b) public returns (uint64) {
    if (a > b) {
      return a;
    } else {
      return b;
    }
  }

  function max(uint64 a, uint64 b, uint64 c) public returns (uint64) {
    if (a > b) {
      if (a > c) {
        return a;
      } else {
        return c;
      }
    } else {
      if (b > c) {
        return b;
      } else {
        return c;
      }
    }
  }
}
