# Murder It Wrote Tests

Browser-based test suite using Mocha and Chai.

## Running Tests

Simply open `tests/index.html` in a browser. The tests will run automatically.

## Test Files

- `test_logic_engine.js` - Tests for the CSP solver
- `test_generator.js` - Tests for truth and clue generation

## Adding New Tests

1. Create a new file `test_yourfeature.js`
2. Add it to `index.html` as a module script
3. Use Mocha's BDD syntax with `describe()` and `it()`
4. Use Chai's `expect` for assertions

Example:
```javascript
const { expect } = chai;

import { yourFunction } from "../js/yourmodule.js";

describe("Your Feature", function () {
  it("should do something", function () {
    expect(yourFunction()).to.equal("expected result");
  });
});
```
