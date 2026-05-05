# wiki-sync

Turn a local NYC-DSA member wiki checkout into JSON files your app can consume.

## You need

- **Node.js** 20+ (22 is fine)
- A working local DokuWiki tree: `dokuwiki/` with `data/` (wiki-data) and `conf/` (wiki-conf) as described in those repos’ READMEs

## Install

```bash
git clone https://github.com/nycdsa/wiki-sync.git
cd wiki-sync
npm install
npm run build
```

Optional: link the CLI globally.

```bash
npm link
```

## Use it

Only one dataset is supported today: **`working-groups`**.

```bash
wiki-sync pull working-groups --out /absolute/path/to/working-groups.json
```

If your `dokuwiki` folder is not next to where you run the command, pass paths explicitly:

```bash
wiki-sync pull working-groups \
  --out /absolute/path/to/working-groups.json \
  --dokuwiki-root /path/to/dokuwiki \
  --wiki-conf-root /path/to/wiki-conf
```

- **`--out`** must be an **absolute** path.
- Wrong dataset name (e.g. `banana`) exits with an error listing valid names.
- More options: `wiki-sync pull --help`

## After you pull wiki data

`wiki-data` is a **backup snapshot** in git, not guaranteed live wiki. If the JSON must match production, refresh your local `data/` (e.g. `git pull` in wiki-data) and re-run `wiki-sync`.

## Develop

```bash
npm test
npm run dev -- pull working-groups --out /tmp/out.json
```
