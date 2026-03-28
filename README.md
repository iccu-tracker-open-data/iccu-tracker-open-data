# E-GMP ICCU Tracker

This project publishes a public, anonymized tracker of reported ICCU-related issues in  E-GMP electric vehicles.

It is an independent community project. It is not affiliated with Hyundai, Kia, Genesis, or Hyundai Motor Group.

This project is not affiliated with, endorsed by, or sponsored by Hyundai Motor Group, Kia Corporation, or any of their subsidiaries. All product names, logos, and brands are property of their respective owners and are used here for identification purposes only. References to suspected ICCU-related issues reflect community reports and working hypotheses, not established findings of fault or causation.

The website helps owners, journalists, researchers, and community members explore patterns in reported incidents, including:

- which models appear in reports
- roughly when affected vehicles were built
- mileage at the time of the reported issue
- whether a recall had already been completed



## What the site does

People can submit a report through a form. After review, approved reports appear on the public site as:

- live summary stats
- charts and filters
- a searchable incident table
- downloadable public data

The goal is to make scattered owner reports easier to understand in one place.

## How it works

The project uses a private moderation sheet behind the scenes and publishes only the rows marked as public.

In simple terms:

1. Someone submits a report.
2. A moderator reviews and cleans it up.
3. Public-safe fields are published to the website.
4. The site updates its charts and incident table from that approved data.

## Run it locally

1. Install dependencies with `npm ci`.
2. Copy [`.env.example`](./.env.example) to `.env`.
3. Start the site with `npm run dev`.

Useful commands:

- `npm test` checks the data-related logic.
- `npm run data:refresh` refreshes the local incident snapshot.
- `npm run generate` builds the static website.
- `npm run preview` previews the generated site locally.

## Main files

- [`pages/index.vue`](./pages/index.vue) contains the homepage experience, charts, filters, and contribution guidance.
- [`data/incidents.generated.json`](./data/incidents.generated.json) is the current public data snapshot used by the site.
- [`docs/manual-setup.md`](./docs/manual-setup.md) describes the current form and sheet setup.

## Sources

The project also tracks community discussion spaces where owners share incident reports and related information:

- [GoingElectric](https://www.goingelectric.de/forum/viewtopic.php?f=531&t=91515) - forum thread tracking ICCU-related reports and discussion
- [r/Ioniq5](https://www.reddit.com/r/Ioniq5/) - community discussion and owner reports for Ioniq 5
- [r/electricvehicles](https://www.reddit.com/r/electricvehicles) - broader EV discussion and incident references

## Contributing

Contributions are welcome, especially for:

- clearer wording and documentation
- data cleanup and moderation workflow improvements
- bug fixes and UI improvements

Before opening a pull request, run:

- `npm test`
- `npm run generate`

## Takedown And Copyright

If you believe any published material infringes your copyright or should be removed for another legitimate reason, contact:

`iccu-tracker-account@proton.me`

Please include enough detail to identify the material and explain the issue clearly.

## License

This repository is licensed under the MIT License.

See [`LICENSE`](./LICENSE).
