# Release TODO

## Required before public launch

- [ ] Add a real `LICENSE` file.
- [ ] Set the real `GH_REPO_URL` in production so the site does not fall back to placeholder repo metadata.
- [ ] Set `SITE_URL` and `SOCIAL_IMAGE_URL` for correct canonical and social sharing metadata.
- [ ] Verify the live Google Form still matches [`docs/manual-setup.md`](./manual-setup.md).
- [ ] Confirm the export tab still uses the `public` flag exactly as documented.

## Recommended next

- [ ] Add an issue template for data corrections and removal requests.
- [ ] Add a screenshot or social card asset for release pages and repository previews.
- [ ] Document the moderation checklist used before setting `public=1`.
- [ ] Decide whether the repository should stay private in `package.json` or be made publishable later.

## Nice to have

- [ ] Add a small smoke test for the generated page output.
- [ ] Add a changelog or release notes file once versioned releases start.
- [ ] Add a sample screenshot to the README.
