# git-sparse-checkout
[![Build Status](https://travis-ci.org/krisselden/git-sparse-checkout.svg?branch=master)](https://travis-ci.org/krisselden/git-sparse-checkout) [![Build status](https://ci.appveyor.com/api/projects/status/wiuiyfu6eo3wogc0/branch/master?svg=true)](https://ci.appveyor.com/project/krisselden/git-sparse-checkout/branch/master)

Sparsely checkout single tag from a remote repo url.

Resolve a tag on a remote repo url, then check if you have the commit local,
otherwise fetch the pack for that commit, and sparsely checkout trees within
the commit to mapped prefixes.

```typescript
import gitSparseCheckout from "git-sparse-checkout";
gitSparseCheckout("git@github.com:Microsoft/TypeScript.git", "v2.9.2", {
  "tests/cases/projects": "vendor/typescript/tests/cases/projects/",
  "tests/cases/project": "vendor/typescript/tests/cases/project/",
  "tests/baselines/reference/project":
    "vendor/typescript/tests/baselines/reference/project/"
});
```
