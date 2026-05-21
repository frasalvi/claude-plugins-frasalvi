#!/usr/bin/env python3
"""
Paper crawler for academic literature surveys.
Queries DBLP and OpenAlex APIs, deduplicates results, and saves to JSON.

Usage:
    python crawl.py --config config.json
    python crawl.py --queries "query1" "query2" --output papers.json
    python crawl.py --queries "query1" "query2" --output papers.json --years 2020-2026

Config JSON format:
{
    "queries": ["query1", "query2", ...],
    "output": "path/to/papers.json",
    "years": "2020-2026"         // optional, default "2019-2026"
}
"""

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def normalize_title(title):
    """Normalize a title for deduplication: lowercase, strip punctuation."""
    if not title:
        return ""
    return re.sub(r"[^a-z0-9]", "", title.lower().strip())


def reconstruct_abstract(inverted_index):
    """Reconstruct abstract text from OpenAlex inverted index format."""
    if not inverted_index:
        return ""
    words = []
    for word, positions in inverted_index.items():
        for pos in positions:
            words.append((pos, word))
    words.sort()
    return " ".join(w for _, w in words)


def fetch_json(url, retries=2, timeout=20):
    """Fetch a URL and parse JSON response, with retries."""
    headers = {"User-Agent": "ResearchCrawler/1.0 (academic literature survey)"}
    last_error = None
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                raw = resp.read().decode("utf-8")
            return json.loads(raw)
        except (urllib.error.URLError, urllib.error.HTTPError, OSError, json.JSONDecodeError) as e:
            last_error = e
            if attempt < retries:
                wait = 2 ** attempt
                print(f"    Retry {attempt + 1}/{retries} after error: {e}", flush=True)
                time.sleep(wait)
    print(f"    FAILED after {retries + 1} attempts: {last_error}", flush=True)
    return None


# ---------------------------------------------------------------------------
# DBLP
# ---------------------------------------------------------------------------

def query_dblp(query, max_results=50):
    """Query DBLP and return a list of paper dicts."""
    params = urllib.parse.urlencode({"q": query, "format": "json", "h": max_results})
    url = f"https://dblp.org/search/publ/api?{params}"
    data = fetch_json(url)
    if data is None:
        return []

    hits = data.get("result", {}).get("hits", {}).get("hit", [])
    if hits is None:
        hits = []

    papers = []
    for hit in hits:
        info = hit.get("info", {})
        title = (info.get("title") or "").rstrip(".")

        # Authors can be a single dict or a list
        authors_raw = info.get("authors", {}).get("author", [])
        if isinstance(authors_raw, dict):
            authors_raw = [authors_raw]
        authors = [
            a.get("text", a) if isinstance(a, dict) else str(a)
            for a in authors_raw
        ]

        # Year
        year_str = info.get("year", "")
        try:
            year = int(year_str)
        except (ValueError, TypeError):
            year = 0

        # URL: prefer DOI, fall back to electronic edition
        doi = info.get("doi", "") or ""
        ee = info.get("ee", "")
        if isinstance(ee, list):
            ee = ee[0] if ee else ""
        paper_url = f"https://doi.org/{doi}" if doi else ee

        # Venue
        venue = info.get("venue", "")
        if isinstance(venue, list):
            venue = venue[0] if venue else ""

        papers.append({
            "title": title,
            "authors": authors,
            "year": year,
            "venue": venue,
            "doi": doi,
            "url": paper_url,
            "abstract": "",
            "source_api": "dblp",
            "source_query": query,
        })

    return papers


# ---------------------------------------------------------------------------
# OpenAlex
# ---------------------------------------------------------------------------

def query_openalex(query, max_results=50, year_range="2019-2026"):
    """Query OpenAlex and return a list of paper dicts."""
    params = urllib.parse.urlencode({
        "search": query,
        "filter": f"publication_year:{year_range}",
        "per_page": max_results,
        "sort": "relevance_score:desc",
        "mailto": "research@example.com",
    })
    url = f"https://api.openalex.org/works?{params}"
    data = fetch_json(url)
    if data is None:
        return []

    results = data.get("results", [])
    if results is None:
        results = []

    papers = []
    for work in results:
        title = (work.get("title") or "").rstrip(".")
        year = work.get("publication_year", 0) or 0

        # Authors (cap at 10 to avoid huge lists)
        authorships = work.get("authorships") or []
        authors = [
            (a.get("author") or {}).get("display_name", "")
            for a in authorships[:10]
        ]
        authors = [a for a in authors if a]

        # Venue
        venue = ""
        primary_location = work.get("primary_location") or {}
        source = primary_location.get("source") or {}
        venue = source.get("display_name", "") or ""

        # Abstract
        abstract = ""
        abs_inv = work.get("abstract_inverted_index")
        if abs_inv:
            abstract = reconstruct_abstract(abs_inv)

        # DOI / URL
        doi_raw = work.get("doi") or ""
        doi = doi_raw.replace("https://doi.org/", "") if doi_raw else ""
        paper_url = doi_raw if doi_raw else (work.get("id") or "")

        papers.append({
            "title": title,
            "authors": authors,
            "year": year,
            "venue": venue,
            "doi": doi,
            "url": paper_url,
            "abstract": abstract[:300] if abstract else "",
            "source_api": "openalex",
            "source_query": query,
        })

    return papers


# ---------------------------------------------------------------------------
# Deduplication
# ---------------------------------------------------------------------------

def deduplicate(papers):
    """Deduplicate papers by normalized title. Keep the richer record."""
    seen = {}
    for p in papers:
        key = normalize_title(p.get("title", ""))
        if not key or len(key) < 10:
            continue
        if key not in seen:
            seen[key] = p
        else:
            # Prefer the record with more information
            existing = seen[key]
            if len(p.get("abstract", "")) > len(existing.get("abstract", "")):
                seen[key] = p
            elif not existing.get("doi") and p.get("doi"):
                seen[key] = p
    return list(seen.values())


# ---------------------------------------------------------------------------
# Main crawl
# ---------------------------------------------------------------------------

def crawl(queries, output_path, year_range="2019-2026"):
    """Run the full crawl: query both APIs, deduplicate, save."""
    all_papers = []
    total = len(queries)
    failed_queries = []

    for i, query in enumerate(queries, 1):
        print(f"[{i}/{total}] {query}", flush=True)

        # DBLP
        dblp_papers = query_dblp(query)
        print(f"  DBLP: {len(dblp_papers)} results", flush=True)
        all_papers.extend(dblp_papers)
        time.sleep(1.0)  # DBLP rate limit

        # OpenAlex
        oa_papers = query_openalex(query, year_range=year_range)
        print(f"  OpenAlex: {len(oa_papers)} results", flush=True)
        all_papers.extend(oa_papers)
        time.sleep(0.5)  # OpenAlex rate limit

        if len(dblp_papers) == 0 and len(oa_papers) == 0:
            failed_queries.append(query)

    # Deduplicate
    deduped = deduplicate(all_papers)

    # Filter by year range if specified
    if year_range:
        try:
            parts = year_range.split("-")
            year_min = int(parts[0])
            year_max = int(parts[1]) if len(parts) > 1 else 9999
            deduped = [
                p for p in deduped
                if p.get("year", 0) == 0 or year_min <= p["year"] <= year_max
            ]
        except (ValueError, IndexError):
            pass  # skip filtering if year_range is malformed

    # Sort by year descending, then title
    deduped.sort(key=lambda p: (-p.get("year", 0), p.get("title", "").lower()))

    # Save
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(deduped, f, indent=2, ensure_ascii=False)

    # Summary
    print(f"\n{'='*60}", flush=True)
    print(f"SUMMARY", flush=True)
    print(f"{'='*60}", flush=True)
    print(f"Queries run:     {total}", flush=True)
    print(f"Total results:   {len(all_papers)}", flush=True)
    print(f"After dedup:     {len(deduped)}", flush=True)
    print(f"Saved to:        {output_path}", flush=True)

    if failed_queries:
        print(f"\nQueries with 0 results ({len(failed_queries)}):", flush=True)
        for q in failed_queries:
            print(f"  - {q}", flush=True)

    # Year distribution
    years = {}
    for p in deduped:
        y = p.get("year", 0)
        if y:
            years[y] = years.get(y, 0) + 1
    if years:
        print(f"\nBy year:", flush=True)
        for y in sorted(years.keys()):
            print(f"  {y}: {years[y]}", flush=True)

    # Top venues
    venues = {}
    for p in deduped:
        v = p.get("venue", "") or "unknown"
        venues[v] = venues.get(v, 0) + 1
    if venues:
        print(f"\nTop venues:", flush=True)
        for v, c in sorted(venues.items(), key=lambda x: -x[1])[:15]:
            print(f"  {v}: {c}", flush=True)

    return deduped


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Crawl DBLP and OpenAlex for academic papers."
    )
    parser.add_argument(
        "--config", type=str, default=None,
        help="Path to JSON config file with queries, output, and optional years."
    )
    parser.add_argument(
        "--queries", nargs="+", type=str, default=None,
        help="Search queries (alternative to --config)."
    )
    parser.add_argument(
        "--output", type=str, default=None,
        help="Output JSON file path (alternative to --config)."
    )
    parser.add_argument(
        "--years", type=str, default="2019-2026",
        help="Year range filter, e.g. '2020-2026'. Default: '2019-2026'."
    )

    args = parser.parse_args()

    # Load config
    if args.config:
        with open(args.config, "r", encoding="utf-8") as f:
            config = json.load(f)
        queries = config["queries"]
        output = config.get("output", "papers.json")
        year_range = config.get("years", args.years)
    elif args.queries and args.output:
        queries = args.queries
        output = args.output
        year_range = args.years
    else:
        parser.error("Provide either --config or both --queries and --output.")
        return

    if not queries:
        print("ERROR: No queries provided.", file=sys.stderr)
        sys.exit(1)

    print(f"Crawling {len(queries)} queries, year range {year_range}", flush=True)
    print(f"Output: {output}\n", flush=True)

    crawl(queries, output, year_range)


if __name__ == "__main__":
    main()
