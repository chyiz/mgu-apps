# mgu-apps

**[MGU Store](https://github.com/robertnisipeanu/mgu-store)** app repository (`chyiz/mgu-apps`) for BMW iDrive 7 (`MGU`) applications.

## Included Apps

| App | Target | Description |
|---|---|---|
| [**Cluster+**](https://github.com/chyiz/idrive7-cluster-plus) | `ID7` (`cluster-render >= 0.4.0`) | A **Stock+** instrument cluster & windshield HUD overlay that keeps BMW's native gauges while adding real-time efficiency, power/charging speed, active gear (`1–8`), hydraulic brake gauge, Oil/Coolant temps, HV battery `%`, right-wing Media/Trip/TPMS/Charging widgets, and HUD navigation. *(Work in progress)* |

---

## Installing via MGU Store

### Option A: Wireless via GitHub (Recommended)

1. Make sure **[MGU Store](https://github.com/robertnisipeanu/mgu-store)** is installed on your head unit and the car has internet access (Wi-Fi hotspot, phone tethering, or USB/LTE uplink).
2. Open **MGU Store** on your iDrive screen and go to **Settings → Add source**.
3. Enter `chyiz/mgu-apps` and choose **Releases** as the channel.
4. Go to the **Store** tab (or tap **Settings → Check now**), select **Cluster+**, and tap **Install**.

> [!NOTE]
> **Cluster+** requires **`cluster-render` (`>= 0.4.0`)**, which is available in MGU Store's built-in `robertnisipeanu/idrive-apps` source. Install `cluster-render` first if you don't already have it.

### Option B: Offline USB Stick

1. Download the release files from this repository's GitHub Releases:
   - `catalog.json` and `cluster_metrics.png` from the **`catalog`** release.
   - `cluster_metrics@<version>.tgz` from the latest **`cluster_metrics@*`** release.
2. Place those files onto a FAT32/exFAT USB stick inside a folder named `mgu-repo/mgu-apps/`.
3. Plug the USB stick into the car and install from **MGU Store → USB**.

---

<details>
<summary><strong>For Maintainers &amp; Offline Source Builds</strong></summary>

Clone with nested submodules and build the offline Store catalog into `dist/`:

```sh
git clone --recurse-submodules https://github.com/chyiz/mgu-apps.git mgu-apps
cd mgu-apps
node release/build_catalog.js
```

Pull the latest commit from `idrive7-cluster-metrics` and update the submodule pointer:

```sh
git -C idrive7-cluster-metrics pull origin main
git add idrive7-cluster-metrics
git commit -m "Update idrive7-cluster-metrics"
```

Pushing a per-app `<id>@<version>` tag (for example `cluster_metrics@0.9.3`) triggers the **Publish MGU Store Release** GitHub Actions workflow, which checks out nested submodules recursively, publishes that app's `.tgz` package under its own release tag, and merges only that app's entry into the rolling `catalog` release without disturbing other apps.

</details>

---

## License

Licensed under the **GNU General Public License v3.0 (GPL-3.0)** — see [LICENSE](LICENSE). Referenced submodules and external dependencies retain their own licenses.
