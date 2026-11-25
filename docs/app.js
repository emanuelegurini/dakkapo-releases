(() => {
  const RELEASES_API = "https://api.github.com/repos/emanuelegurini/dakkapo-releases/releases?per_page=5";

  function formatMegabytes(bytes) {
    if (!bytes || Number.isNaN(bytes)) return null;
    return `${Math.round(bytes / (1024 * 1024))} MB`;
  }

  function formatDateIt(iso) {
    if (!iso) return "";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("it-IT", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(date);
  }

  function extractNotes(body) {
    if (!body || typeof body !== "string") return [];
    return body
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"))
      .map((line) => line.replace(/^[-*•]\s+/, "").replace(/\*\*(.*?)\*\*/g, "$1"))
      .slice(0, 6);
  }

  function renderReleaseList(releases) {
    const container = document.getElementById("release-list");
    if (!container || !Array.isArray(releases) || releases.length === 0) return;

    const fragment = document.createDocumentFragment();

    releases.forEach((release, index) => {
      const tag = release.tag_name;
      if (!tag) return;

      const apkAsset = Array.isArray(release.assets)
        ? release.assets.find((asset) => typeof asset.name === "string" && asset.name.endsWith(".apk"))
        : null;
      const downloadUrl = apkAsset?.browser_download_url || release.html_url;
      const sizeLabel = apkAsset ? formatMegabytes(apkAsset.size) : null;
      const dateLabel = formatDateIt(release.published_at);
      const notes = extractNotes(release.body);

      const card = document.createElement("article");
      card.className = "release-card";

      const head = document.createElement("div");
      head.className = "release-card-head";

      const titleGroup = document.createElement("div");
      titleGroup.className = "release-title-group";

      const tagEl = document.createElement("span");
      tagEl.className = "release-tag";
      tagEl.textContent = tag;
      titleGroup.appendChild(tagEl);

      if (index === 0) {
        const badgeEl = document.createElement("span");
        badgeEl.className = "release-badge";
        badgeEl.textContent = "Ultima";
        titleGroup.appendChild(badgeEl);
      }

      if (dateLabel) {
        const timeEl = document.createElement("time");
        timeEl.className = "release-date";
        timeEl.setAttribute("datetime", release.published_at || "");
        timeEl.textContent = dateLabel;
        titleGroup.appendChild(timeEl);
      }

      head.appendChild(titleGroup);

      if (downloadUrl) {
        const dlLink = document.createElement("a");
        dlLink.className = "release-dl";
        dlLink.href = downloadUrl;
        dlLink.target = "_blank";
        dlLink.rel = "noopener noreferrer";
        dlLink.textContent = sizeLabel ? `Scarica APK · ${sizeLabel}` : "Apri release";
        head.appendChild(dlLink);
      }

      card.appendChild(head);

      const notesList = document.createElement("ul");
      notesList.className = "release-notes";
      const items = notes.length > 0 ? notes : ["Release pubblicata su GitHub Releases con APK firmato e checksum SHA-256."];
      items.forEach((line) => {
        const li = document.createElement("li");
        li.textContent = line;
        notesList.appendChild(li);
      });
      card.appendChild(notesList);

      fragment.appendChild(card);
    });

    if (fragment.childNodes.length > 0) {
      container.replaceChildren(fragment);
    }
  }

  async function hydrateReleases() {
    try {
      const response = await fetch(RELEASES_API, {
        headers: { Accept: "application/vnd.github+json" },
      });
      if (!response.ok) return;

      const releases = await response.json();
      if (!Array.isArray(releases) || releases.length === 0) return;

      const published = releases.filter((r) => !r.draft && !r.prerelease);
      const latest = published[0] || releases[0];
      const tag = latest?.tag_name;
      if (!tag) return;

      const apkAsset = Array.isArray(latest.assets)
        ? latest.assets.find((asset) => typeof asset.name === "string" && asset.name.endsWith(".apk"))
        : null;

      const downloadUrl = apkAsset?.browser_download_url || latest.html_url;
      const sizeLabel = apkAsset ? formatMegabytes(apkAsset.size) : null;

      document.querySelectorAll("[data-download-link]").forEach((el) => {
        if (downloadUrl) el.setAttribute("href", downloadUrl);
      });

      document.querySelectorAll("[data-download-text]").forEach((el) => {
        el.textContent = `Scarica APK (${tag})`;
      });

      document.querySelectorAll("[data-version-value]").forEach((el) => {
        el.textContent = tag;
      });

      document.querySelectorAll("[data-version-raw]").forEach((el) => {
        el.textContent = tag;
      });

      document.querySelectorAll("[data-release-label]").forEach((el) => {
        el.textContent = `Android nativo · Release ${tag} · 100% offline`;
      });

      document.querySelectorAll("[data-release-footer]").forEach((el) => {
        el.textContent = `Release ${tag}`;
      });

      if (sizeLabel) {
        document.querySelectorAll("[data-size-value]").forEach((el) => {
          el.textContent = `${sizeLabel} (modello IT incluso)`;
        });
      }

      renderReleaseList(published.length > 0 ? published : releases);
    } catch {
      // Mantiene i valori statici di fallback su v0.2.0 in caso di rete assente o rate limit API.
    }
  }

  function setupLightbox() {
    const lightbox = document.getElementById("lightbox");
    const img = document.getElementById("lightbox-img");
    const caption = document.getElementById("lightbox-caption");
    const closeBtn = document.getElementById("lightbox-close");
    if (!lightbox || !img || !caption || !closeBtn) return;

    function open(src, text) {
      img.src = src;
      img.alt = text || "";
      caption.textContent = text || "";
      lightbox.hidden = false;
      document.body.style.overflow = "hidden";
      closeBtn.focus();
    }

    function close() {
      lightbox.hidden = true;
      img.src = "";
      document.body.style.overflow = "";
    }

    document.querySelectorAll("[data-lightbox-src]").forEach((trigger) => {
      trigger.addEventListener("click", () => {
        open(
          trigger.getAttribute("data-lightbox-src"),
          trigger.getAttribute("data-lightbox-caption")
        );
      });
    });

    closeBtn.addEventListener("click", close);
    lightbox.addEventListener("click", (event) => {
      if (event.target === lightbox) close();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !lightbox.hidden) close();
    });
  }

  function setupCopyAdb() {
    const btn = document.querySelector("[data-copy-adb]");
    if (!btn) return;
    btn.addEventListener("click", async () => {
      const versionEl = document.querySelector("[data-version-raw]");
      const version = versionEl ? versionEl.textContent.trim() : "v0.2.0";
      const cmd = `adb install -r dakkapo-${version}.apk`;
      try {
        await navigator.clipboard.writeText(cmd);
        const original = btn.textContent;
        btn.textContent = "Copiato";
        window.setTimeout(() => {
          btn.textContent = original;
        }, 1600);
      } catch {
        // Clipboard API non disponibile in contesto non sicuro.
      }
    });
  }

  hydrateReleases();
  setupLightbox();
  setupCopyAdb();
})();
