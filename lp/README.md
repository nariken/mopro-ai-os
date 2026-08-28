# MOPRO AI OS landing page draft

This is a local-only draft for the future `ailabo.nariken.ai` landing page. It references the
repository's existing brand assets, product captures, and 60-second demo video.

From the repository root, start the local preview:

```sh
pnpm exec vite --host 127.0.0.1 --port 4173
```

Then open `http://127.0.0.1:4173/lp/`.

The page is not wired to a form backend and is not ready for deployment as a standalone directory;
asset packaging is handled by:

```sh
node lp/build.mjs
```

The deployable, self-contained site is generated in `lp/dist/`.
