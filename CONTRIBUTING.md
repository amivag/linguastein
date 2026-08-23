# Contributing

Linguastein is in **alpha**. The data model, the stored shape of
learner progress and the exercise mix may all change drastically, so before
investing in a large change, open an issue first — it may be about to move.

## Before you push

```bash
npm run check
```

That runs type-checking, lint, the test suite against the coverage floors,
dataset validation and Prettier's check, in the same order CI does — and keeping
those two lists identical is the point, so add a step to both or to neither.
`npm run format` writes the formatting rather than only reporting it.

[AGENTS.md](AGENTS.md) has the architecture rules a change is expected to
respect: the engine in `src/domain` stays pure and framework-free, content is
described rather than hard-coded, and the accessibility contract is enforced by
tests rather than by review.

## Licensing your contribution

The code is AGPL-3.0-only and the datasets are CC BY-SA 4.0, but the copyright is
held by one person, which is what keeps a future commercial licence possible
(see the licence section of the [README](README.md#licence)). A patch whose
copyright sits elsewhere would quietly remove that option for everyone.

So: **sign off every commit**, certifying the
[Developer Certificate of Origin](https://developercertificate.org/) — that the
work is yours to give and that you agree to it being distributed under this
project's licences, and under any other licence the copyright holder later offers
it under.

```bash
git commit -s -m "your message"
```

`-s` appends the `Signed-off-by:` line. Commits without it will be asked for one
before merge.

## Style

There is no separate style guide; Prettier and ESLint are the style guide, and
both run in `npm run check`. The one convention worth stating explicitly is that
comments explain _why_ rather than _what_ — the existing code is the reference for
how much of that is expected.
