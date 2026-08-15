export default new class extends SubtitleSource {
  async test() {
    const res = await fetch("https://subtitles.website/")
    if (!res.ok) throw new Error("Subtitle Search Engine no responde")
    return true
  }

  async single(query) {
    const titles = (query.titles || []).filter(Boolean)
    const episode = Number(query.episode || 0)
    const anidbEid = query.anidbEid

    const searches = []
    if (query.imdbId) {
      searches.push(
        "https://subtitles.website/strapi/api/search/subtitles?imdb=" +
        encodeURIComponent(query.imdbId) + "&language=es&format=srt"
      )
    }

    for (const title of titles.slice(0, 2)) {
      searches.push(
        "https://subtitles.website/strapi/api/search/subtitles?title=" +
        encodeURIComponent(title) + "&language=es&format=srt"
      )
    }

    const all = []

    for (const url of searches) {
      try {
        const res = await query.fetch(url)
        if (!res.ok) continue
        const data = await res.json()
        if (Array.isArray(data.data)) all.push(...data.data)
      } catch (_) {}
    }

    const seen = new Set()

    function episodeScore(item) {
      if (!episode) return 0

      const text = [
        item.release || "",
        item.file_name || "",
        item.name || "",
        item.film_title || ""
      ].join(" ")

      const patterns = [
        new RegExp("\\bS\\d{1,2}E0*" + episode + "\\b", "i"),
        new RegExp("\\bE0*" + episode + "\\b", "i"),
        new RegExp("\\bEP(?:ISODE)?[ ._-]*0*" + episode + "\\b", "i"),
        new RegExp("[^0-9]0*" + episode + "[^0-9]", "i")
      ]

      for (let i = 0; i < patterns.length; i++) {
        if (patterns[i].test(text)) return 100 - i * 10
      }

      return 0
    }

    all.sort((a, b) => episodeScore(b) - episodeScore(a))

    const results = []

    for (const item of all) {
      if (String(item.language?.code || "").toLowerCase() !== "es") continue
      if (!item.id || seen.has(item.id)) continue
      seen.add(item.id)

      try {
        const dl = await query.fetch(
          "https://subtitles.website/strapi/api/search/download/" +
          encodeURIComponent(item.id)
        )

        if (!dl.ok) continue

        const data = await dl.json()
        let url = data.download_url || ""

        if (url.startsWith("/")) {
          url = "https://subtitles.website/strapi" + url
        }

        if (url) {
          results.push({
            url: url,
            language: "ES"
          })
        }
      } catch (_) {}

      if (results.length >= 8) break
    }

    return results
  }
}