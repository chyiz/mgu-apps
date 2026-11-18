# mgu-apps

MGU App Store repository (`https://github.com/chyiz/mgu-apps`) indexing custom BMW iDrive 7 (`MGU`) applications as nested Git submodules.

## Included Apps

| App ID | Title | Target | Submodule | Description |
|---|---|---|---|---|
| `cluster_metrics` | **Cluster Metrics** | `ID7` (`cluster-render >= 0.4.0`) | `idrive7-cluster-metrics` | Real-time `mi/kWh`, `MPG`, or plug-in charging `kW`, HV battery `%` (`SOC`), powertrain temps (`OIL`, `CL`), active gear (`1–8` next to `D`), Right-Wing Media (with CJK titles & full gauge-edge album art), Trip, & auto-locking Charging Finish Time widgets via BC cycling, 3-tab settings (`General`, `Cluster`, `HUD`), HUD nav banner, and `DSC 0x29` brake bar. |

---

## Installing via MGU Store

### Option A: GitHub Source (`Releases` channel — recommended)
Because GitHub source tarballs omit Git submodule contents on `branch` channels, pushing a `v*.*.*` tag (or triggering the **Publish MGU Store Release** workflow) checks out all submodules recursively and publishes:
- Versioned `<id>@<version>.tgz` packages (with `node_modules/oap-sdk` omitted so your head unit links its own donor `oap-sdk`), `<id>.png` icons, and `mgu-store.json`.
- A rolling `catalog` release (`catalog.json`, Schema 2) read automatically by the MGU Store when you add `chyiz/mgu-apps` on **Releases**.

### Option B: Offline USB Stick (`catalog.json` or Repo Tree)
1. Clone with submodules and build the offline Store catalog:
   ```sh
   git clone --recurse-submodules https://github.com/chyiz/mgu-apps.git mgu-apps
   cd mgu-apps
   node release/build_catalog.js
   ```
2. Copy `dist/` onto a FAT32/exFAT USB stick as `mgu-repo/mgu-apps/` (containing `catalog.json`, `cluster_metrics@0.7.1.tgz`, and `cluster_metrics.png`), plug it into the car, and install from **MGU Store → Sources → USB**.
   *(Alternatively, copying the full working tree with initialized submodules onto a USB stick uses `mgu-repo.json` directly so the head unit builds from source.)*

---

## Working with Nested App Submodules

Initialize or update nested repositories after cloning:

```sh
git submodule update --init --recursive
```

Pull the latest commit from `idrive7-cluster-metrics` and record the updated submodule pointer:

```sh
git -C idrive7-cluster-metrics pull origin main
git add idrive7-cluster-metrics
git commit -m "Update idrive7-cluster-metrics"
```

Add another app repository in the future:

```sh
git submodule add ../<new-app-repo> <new-app-repo>
# Then add an entry to mgu-repo.json under "components"
```

---

## License

Licensed under the **PolyForm Noncommercial License 1.0.0** ([LICENSE](LICENSE)) — noncommercial and personal use only (`Required Notice: Copyright (c) 2026 chyiz (https://github.com/chyiz)`). Referenced submodules and external dependencies retain their own licenses.
