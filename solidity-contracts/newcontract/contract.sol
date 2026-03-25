pragma solidity 0;

contract incrementer {
  uint64 private value;

  /// Initializes the value to the given init_value.
  function initialize(uint64 initvalue) public {
    value = initvalue;
  }

  /// This increments the value by by.
  function inc(uint64 by) public {
    value += by;
  }

  /// Simply returns the current value of our uint64.
  function get() public view returns (uint64) {
    return value;
  }
}
